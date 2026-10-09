package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.zvote.server.identity.VoterIdentity;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The live stream over a real HTTP connection: server-sent events are about
 * framing, buffering and timing, which only a real socket shows.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PollEventsTest {

    private static final SecureRandom RANDOM = new SecureRandom();

    @LocalServerPort
    int port;

    final HttpClient http = HttpClient.newHttpClient();
    final String alice = newVoter();
    String poll;
    List<String> options;
    Events events;

    @BeforeEach
    void createAndWatchAPoll() throws Exception {
        var created = send(alice, "POST", "/api/polls", """
            {"title": "Lunch?", "votingSystem": "MAJORITY_JUDGMENT", "visibility": "UNLISTED",
             "options": ["Ramen", "Tacos"]}
            """);
        poll = JsonPath.read(created.body(), "$.id");
        options = JsonPath.read(created.body(), "$.options[*].id");
        events = watch(poll);
    }

    @AfterEach
    void stopWatching() {
        events.close();
    }

    @Test
    void theFirstEventIsTheCurrentState() throws Exception {
        var first = events.next();

        assertThat(first.name()).isEqualTo("update");
        assertThat(JsonPath.<Integer>read(first.data(), "$.totalBallots")).isZero();
        assertThat(first.data()).doesNotContain("isMine", "myBallot");
    }

    @Test
    void aBurstOfBallotsArrivesAsFewUpdatesWithTheFinalCount() throws Exception {
        events.next();

        var voters = IntStream.range(0, 10).mapToObj(i -> Thread.ofVirtual().start(() -> castBallot(newVoter())))
            .toList();
        for (var voter : voters) {
            voter.join();
        }

        var updates = new ArrayList<Event>();
        do {
            updates.add(events.next());
        } while (JsonPath.<Integer>read(updates.getLast().data(), "$.totalBallots") < 10);
        assertThat(updates).hasSizeLessThan(10);
    }

    @Test
    void closingThePollIsPushed() throws Exception {
        events.next();

        send(alice, "PATCH", "/api/polls/" + poll, "{\"closed\": true}");

        assertThat(JsonPath.<String>read(events.next().data(), "$.closedAt")).isNotNull();
    }

    @Test
    void deletingThePollEndsTheStream() throws Exception {
        events.next();

        send(alice, "DELETE", "/api/polls/" + poll, null);

        assertThat(events.next().name()).isEqualTo("deleted");
    }

    @Test
    void theNamesVotersGiveArePushedWithoutTheirBallots() throws Exception {
        var created = send(alice, "POST", "/api/polls", """
            {"title": "Trip?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
             "showVoterNames": true, "options": ["Lisbon", "Oslo"]}
            """);
        var trip = JsonPath.<String>read(created.body(), "$.id");
        var lisbon = JsonPath.<List<String>>read(created.body(), "$.options[*].id").getFirst();
        try (var tripEvents = watch(trip)) {
            assertThat(JsonPath.<List<String>>read(tripEvents.next().data(), "$.voterNames")).isEmpty();

            send(newVoter(), "PUT", "/api/polls/" + trip + "/ballot", """
                {"approvedOptionIds": ["%s"], "voterName": "Zoé"}
                """.formatted(lisbon));

            var update = tripEvents.next().data();
            assertThat(JsonPath.<List<String>>read(update, "$.voterNames")).containsExactly("Zoé");
            assertThat(update).doesNotContain("myBallot");
        }
    }

    @Test
    void resultsShownOnceClosedArriveWithTheClosing() throws Exception {
        var created = send(alice, "POST", "/api/polls", """
            {"title": "Trip?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
             "resultsShown": "AFTER_CLOSING", "options": ["Lisbon", "Oslo"]}
            """);
        var trip = JsonPath.<String>read(created.body(), "$.id");
        var lisbon = JsonPath.<List<String>>read(created.body(), "$.options[*].id").getFirst();
        try (var tripEvents = watch(trip)) {
            tripEvents.next();

            send(newVoter(), "PUT", "/api/polls/" + trip + "/ballot", """
                {"approvedOptionIds": ["%s"]}
                """.formatted(lisbon));
            var ballot = tripEvents.next().data();
            send(alice, "PATCH", "/api/polls/" + trip, "{\"closed\": true}");
            var closing = tripEvents.next().data();

            assertThat(JsonPath.<Integer>read(ballot, "$.totalBallots")).isEqualTo(1);
            assertThat(JsonPath.<List<Integer>>read(ballot, "$.options[*].approvalCount")).containsOnlyNulls();
            assertThat(JsonPath.<List<Integer>>read(closing, "$.options[*].approvalCount")).containsExactly(1, 0);
        }
    }

    @Test
    void aPollThatDoesNotExistCannotBeWatched() throws Exception {
        var response = http.send(HttpRequest.newBuilder(uri("/api/polls/nope/events"))
                .header("Accept", "text/event-stream") // as browsers send it
                .build(),
            HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.headers().firstValue("Content-Type")).contains("application/problem+json");
    }

    // --- helpers --------------------------------------------------------------

    record Event(String name, String data) {}

    /** Parses the event stream on its own thread, so a test can wait for the next event. */
    static final class Events implements AutoCloseable {

        private final BlockingQueue<Event> received = new LinkedBlockingQueue<>();
        private final Stream<String> lines;

        Events(Stream<String> lines) {
            this.lines = lines;
            Thread.ofVirtual().start(this::read);
        }

        Event next() throws InterruptedException {
            var event = received.poll(5, TimeUnit.SECONDS);
            assertThat(event).as("an event within 5 seconds").isNotNull();
            return event;
        }

        private void read() {
            String name = null;
            var data = new StringBuilder();
            try {
                for (var line : (Iterable<String>) lines::iterator) {
                    if (line.startsWith("event:")) {
                        name = line.substring("event:".length());
                    } else if (line.startsWith("data:")) {
                        data.append(line.substring("data:".length()));
                    } else if (line.isEmpty() && name != null) { // heartbeats are comments and have no name
                        received.add(new Event(name, data.toString()));
                        name = null;
                        data.setLength(0);
                    }
                }
            } catch (UncheckedIOException closed) {
                // close() was called: the test is over.
            }
        }

        @Override
        public void close() {
            lines.close();
        }
    }

    Events watch(String pollId) throws Exception {
        var request = HttpRequest.newBuilder(uri("/api/polls/" + pollId + "/events"))
            .header("Accept", "text/event-stream")
            .build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofLines());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
            type -> assertThat(type).startsWith("text/event-stream"));
        return new Events(response.body());
    }

    void castBallot(String voter) {
        try {
            var response = send(voter, "PUT", "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Good", "%s": "Fair"}}
                """.formatted(options.get(0), options.get(1)));
            assertThat(response.statusCode()).isEqualTo(200);
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException(e);
        }
    }

    HttpResponse<String> send(String voter, String method, String path, String json)
        throws IOException, InterruptedException {
        var body = json == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(json);
        var request = HttpRequest.newBuilder(uri(path))
            .method(method, body)
            .header("Content-Type", "application/json")
            .header("Cookie", VoterIdentity.COOKIE + "=" + voter)
            .timeout(Duration.ofSeconds(5))
            .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    static String newVoter() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
