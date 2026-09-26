package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.zvote.server.identity.VoterIdentity;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

/** The HTTP contract of the poll API, exercised the way a client uses it. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PollApiTest {

    @Autowired
    MockMvcTester mvc;

    Voter alice;
    Voter bob;

    @BeforeEach
    void meetTheVoters() {
        alice = Voter.random();
        bob = Voter.random();
    }

    @Nested
    class CreatingAPoll {

        @Test
        void startsWithEveryTallyAtZero() {
            var result = post(alice, "/api/polls", """
                {"title": "Where do we eat?", "votingSystem": "MAJORITY_JUDGMENT",
                 "visibility": "PUBLIC", "options": ["Ramen", "Tacos"]}
                """);

            assertThat(result).hasStatus(HttpStatus.CREATED);
            var id = JsonPath.<String>read(body(result), "$.id");
            assertThat(result).hasHeader(HttpHeaders.LOCATION, "/api/polls/" + id);
            assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Where do we eat?");
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(true);
            assertThat(result).bodyJson().extractingPath("$.closedAt").isNull();
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
            assertThat(result).bodyJson().extractingPath("$.options[*].label").isEqualTo(List.of("Ramen", "Tacos"));
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap().containsExactly(
                entry("Bad", 0), entry("Inadequate", 0), entry("Passable", 0), entry("Fair", 0),
                entry("Good", 0), entry("VeryGood", 0), entry("Excellent", 0));
            assertThat(result).bodyJson().extractingPath("$.createdAt").asString().matches("\\d{4}-\\d{2}-\\d{2}T.*Z");
        }

        @Test
        void trimsTheTitleAndOptions() {
            var result = post(alice, "/api/polls", """
                {"title": "  Lunch?  ", "votingSystem": "APPROVAL",
                 "visibility": "UNLISTED", "options": [" Ramen ", "Tacos\\n"]}
                """);

            assertThat(result).hasStatus(HttpStatus.CREATED);
            assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Lunch?");
            assertThat(result).bodyJson().extractingPath("$.options[*].label").isEqualTo(List.of("Ramen", "Tacos"));
            assertThat(result).bodyJson().extractingPath("$.options[0].approvalCount").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").isNull();
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("org.zvote.server.api.PollApiTest#invalidPolls")
        void explainsWhatIsWrong(String json, String explanation) {
            var result = post(alice, "/api/polls", json);

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains(explanation);
        }
    }

    static Stream<Arguments> invalidPolls() {
        var tooMany = IntStream.rangeClosed(1, 21).mapToObj(i -> "\"Option " + i + "\"")
            .collect(Collectors.joining(", ", "[", "]"));
        return Stream.of(
            Arguments.of(poll("  ", "[\"A\", \"B\"]"), "needs a title"),
            Arguments.of(poll("x".repeat(201), "[\"A\", \"B\"]"), "at most 200 characters"),
            Arguments.of(poll("Lunch?", "[\"A\"]"), "between 2 and 20 options"),
            Arguments.of(poll("Lunch?", tooMany), "between 2 and 20 options"),
            Arguments.of(poll("Lunch?", "[\"A\", \" \"]"), "cannot be empty"),
            Arguments.of(poll("Lunch?", "[\"A\", \"" + "x".repeat(101) + "\"]"), "at most 100 characters"),
            Arguments.of(poll("Lunch?", "[\"Ramen\", \"ramen\"]"), "listed twice"),
            Arguments.of("{\"title\": \"Lunch?\", \"visibility\": \"PUBLIC\", \"options\": [\"A\", \"B\"]}",
                "voting system"),
            Arguments.of("{\"title\": \"Lunch?\", \"votingSystem\": \"APPROVAL\", \"options\": [\"A\", \"B\"]}",
                "visibility"),
            Arguments.of("{\"title\": \"Lunch?\", \"votingSystem\": \"APPROVAL\", \"visibility\": \"PRIVATE\","
                + " \"options\": [\"A\", \"B\"]}", "could not be read"),
            Arguments.of("{not json", "could not be read"));
    }

    private static String poll(String title, String options) {
        return """
            {"title": "%s", "votingSystem": "MAJORITY_JUDGMENT", "visibility": "PUBLIC", "options": %s}
            """.formatted(title, options);
    }

    @Nested
    class FindingAPoll {

        @Test
        void publicPollsAreListedAndUnlistedOnesAreNot() {
            var listed = createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");
            var unlisted = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");

            var ids = JsonPath.<List<String>>read(body(get(bob, "/api/polls")), "$[*].id");

            assertThat(ids).contains(listed).doesNotContain(unlisted);
        }

        @Test
        void anyoneWithTheLinkCanOpenAnUnlistedPoll() {
            var unlisted = createPoll(alice, "APPROVAL", "UNLISTED");

            var result = get(bob, "/api/polls/" + unlisted);

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(false);
        }

        @Test
        void mineListsTheCallersPollsNewestFirst() {
            var first = createPoll(alice, "APPROVAL", "UNLISTED");
            var second = createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");
            createPoll(bob, "APPROVAL", "PUBLIC");

            var result = get(alice, "/api/polls/mine");

            assertThat(JsonPath.<List<String>>read(body(result), "$[*].id")).containsExactly(second, first);
            assertThat(result).bodyJson().extractingPath("$[*].isMine").isEqualTo(List.of(true, true));
        }

        @Test
        void anUnknownPollIsNotFound() {
            var result = get(bob, "/api/polls/no-such-poll");

            assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("does not exist");
        }

        @Test
        void nothingCanBeDoneToAnUnknownPoll() {
            assertThat(put(alice, "/api/polls/no-such-poll/ballot", "{\"judgments\": {}}")).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(patch(alice, "/api/polls/no-such-poll", "{\"closed\": true}")).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(delete(alice, "/api/polls/no-such-poll")).hasStatus(HttpStatus.NOT_FOUND);
        }

        @Test
        void aPollReadsBackExactlyAsItWasAnswered() {
            var created = post(alice, "/api/polls", """
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "PUBLIC", "options": ["Ramen", "Tacos"]}
                """);
            var poll = JsonPath.<String>read(body(created), "$.id");
            var closed = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            var read = body(get(bob, "/api/polls/" + poll));

            assertThat(JsonPath.<String>read(read, "$.createdAt")).isEqualTo(JsonPath.read(body(created), "$.createdAt"));
            assertThat(JsonPath.<String>read(read, "$.closedAt")).isEqualTo(JsonPath.read(body(closed), "$.closedAt"));
        }
    }

    @Nested
    class MajorityJudgmentBallots {

        String poll;
        String ramen;
        String tacos;

        @BeforeEach
        void createPoll() {
            poll = PollApiTest.this.createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");
            var options = optionIds(poll);
            ramen = options.get(0);
            tacos = options.get(1);
        }

        @Test
        void everyBallotIsTallied() {
            castJudgments(alice, "Excellent", "Good");
            var result = castJudgments(bob, "Good", "Bad");

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(2);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap()
                .contains(entry("Excellent", 1), entry("Good", 1), entry("Bad", 0));
            assertThat(result).bodyJson().extractingPath("$.options[1].judgmentCounts").asMap()
                .contains(entry("Good", 1), entry("Bad", 1));
        }

        @Test
        void theVoterGetsTheirBallotBackAndNobodyElseDoes() {
            castJudgments(alice, "Excellent", "Good");

            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot.judgments")
                .asMap().containsExactly(entry(ramen, "Excellent"), entry(tacos, "Good"));
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void castingAgainRevisesTheBallot() {
            castJudgments(alice, "Excellent", "Good");
            var result = castJudgments(alice, "Fair", "Fair");

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap()
                .contains(entry("Excellent", 0), entry("Fair", 1));
        }

        @Test
        void optionsLeftUngradedCountAsBad() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "VeryGood"}}
                """.formatted(ramen));

            assertThat(result).bodyJson().extractingPath("$.options[1].judgmentCounts").asMap()
                .contains(entry("Bad", 1));
            assertThat(result).bodyJson().extractingPath("$.myBallot.judgments")
                .asMap().containsExactly(entry(ramen, "VeryGood"), entry(tacos, "Bad"));
        }

        @Test
        void anEmptyBallotWithdraws() {
            castJudgments(alice, "Excellent", "Good");
            var result = put(alice, "/api/polls/" + poll + "/ballot", "{\"judgments\": {}}");

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void rejectsWhatIsNotAMention() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Superb"}}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString()
                .contains("\"Superb\" is not a mention", "VeryGood");
        }

        @Test
        void rejectsOptionsOfAnotherPoll() {
            var otherPoll = PollApiTest.this.createPoll(bob, "MAJORITY_JUDGMENT", "PUBLIC");
            var foreign = optionIds(otherPoll).getFirst();

            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Excellent"}}
                """.formatted(foreign));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("not an option of this poll");
        }

        @Test
        void simultaneousBallotsFromOneVoterLeaveOneBallot() throws InterruptedException {
            var statuses = new ConcurrentLinkedQueue<Integer>();
            var voters = IntStream.range(0, 20)
                .mapToObj(i -> Thread.ofVirtual().start(
                    () -> statuses.add(castJudgments(alice, "Good", "Fair").getResponse().getStatus())))
                .toList();
            for (var voter : voters) {
                voter.join();
            }

            assertThat(statuses).hasSize(20).containsOnly(200, 409).contains(200);
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
        }

        @Test
        void rejectsAnApprovalBallot() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"approvedOptionIds": ["%s"]}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("majority judgment poll");
        }

        private MvcTestResult castJudgments(Voter voter, String forRamen, String forTacos) {
            return put(voter, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "%s", "%s": "%s"}}
                """.formatted(ramen, forRamen, tacos, forTacos));
        }
    }

    @Nested
    class ApprovalBallots {

        String poll;
        String ramen;
        String tacos;

        @BeforeEach
        void createPoll() {
            poll = PollApiTest.this.createPoll(alice, "APPROVAL", "PUBLIC");
            var options = optionIds(poll);
            ramen = options.get(0);
            tacos = options.get(1);
        }

        @Test
        void countsApprovalsAndVoters() {
            approve(alice, ramen, tacos);
            var result = approve(bob, ramen);

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(2);
            assertThat(result).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(List.of(2, 1));
            assertThat(result).bodyJson().extractingPath("$.myBallot.approvedOptionIds").isEqualTo(List.of(ramen));
        }

        @Test
        void approvingNothingWithdraws() {
            approve(alice, ramen);
            var result = approve(alice);

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @ParameterizedTest(name = "\"{0}\"")
        @ValueSource(strings = {"Ramen", "", "-1", "99999999999999999999"})
        void rejectsWhatIsNotAnOptionOfThisPoll(String optionId) {
            var result = approve(alice, ramen, optionId);

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString()
                .isEqualTo("\"" + optionId + "\" is not an option of this poll.");
            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void rejectsAMajorityJudgmentBallot() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Good"}}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("approval poll");
        }

        private MvcTestResult approve(Voter voter, String... optionIds) {
            var ids = Arrays.stream(optionIds).map(id -> "\"" + id + "\"").collect(Collectors.joining(", "));
            return put(voter, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [" + ids + "]}");
        }
    }

    @Nested
    class ClosingAndDeleting {

        @Test
        void aClosedPollKeepsItsResultsAndRefusesBallots() {
            var poll = createPoll(alice, "APPROVAL", "PUBLIC");
            var ramen = optionIds(poll).getFirst();
            put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            var closed = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");
            var lateBallot = put(alice, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            assertThat(closed).hasStatus(HttpStatus.OK);
            assertThat(closed).bodyJson().extractingPath("$.closedAt").isNotNull();
            assertThat(closed).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
            assertThat(lateBallot).hasStatus(HttpStatus.CONFLICT);
            assertThat(lateBallot).bodyJson().extractingPath("$.detail").asString().contains("closed");
        }

        @Test
        void aReopenedPollAcceptsBallotsAgain() {
            var poll = createPoll(alice, "APPROVAL", "PUBLIC");
            var ramen = optionIds(poll).getFirst();
            patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            var reopened = patch(alice, "/api/polls/" + poll, "{\"closed\": false}");
            var ballot = put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            assertThat(reopened).bodyJson().extractingPath("$.closedAt").isNull();
            assertThat(ballot).hasStatus(HttpStatus.OK);
        }

        @Test
        void onlyTheCreatorCanCloseOrDelete() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");

            assertThat(patch(bob, "/api/polls/" + poll, "{\"closed\": true}")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(delete(bob, "/api/polls/" + poll)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.closedAt").isNull();
        }

        @Test
        void deletingRemovesThePollForEveryone() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");
            var ramen = optionIds(poll).getFirst();
            put(bob, "/api/polls/" + poll + "/ballot", "{\"judgments\": {\"" + ramen + "\": \"Good\"}}");

            assertThat(delete(alice, "/api/polls/" + poll)).hasStatus(HttpStatus.NO_CONTENT);
            assertThat(get(bob, "/api/polls/" + poll)).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(JsonPath.<List<String>>read(body(get(bob, "/api/polls")), "$[*].id")).doesNotContain(poll);
        }

        @Test
        void aChangeMustSayWhatToChange() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "PUBLIC");

            assertThat(patch(alice, "/api/polls/" + poll, "{}")).hasStatus(HttpStatus.BAD_REQUEST);
        }
    }

    @Nested
    class Identity {

        @Test
        void aNewcomerIsGivenAnHttpOnlyVoterCookie() {
            var result = mvc.get().uri("/api/polls").exchange();

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(VoterIdentity.COOKIE + "=")
                .contains("HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=");
        }

        @Test
        void aKnownVoterKeepsTheirIdentity() {
            var poll = createPoll(alice, "APPROVAL", "PUBLIC");

            var result = get(alice, "/api/polls/" + poll);

            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(true);
        }

        @Test
        void aCookieTheServerCouldNotHaveIssuedIsReplaced() {
            var result = mvc.get().uri("/api/polls")
                .cookie(new Cookie(VoterIdentity.COOKIE, "alice")).exchange();

            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(VoterIdentity.COOKIE + "=")
                .doesNotStartWith(VoterIdentity.COOKIE + "=alice");
        }

        @Test
        void neitherTheTokenNorTheVoterIdIsEverSent() {
            var poll = createPoll(alice, "APPROVAL", "PUBLIC");

            var body = body(get(alice, "/api/polls/" + poll));

            assertThat(body)
                .doesNotContain(alice.token())
                .doesNotContain(VoterIdentity.voterIdOf(alice.token()))
                .doesNotContain("creator");
        }

        @Test
        void healthChecksDoNotGetACookie() {
            var result = mvc.get().uri("/actuator/health").exchange();

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        }
    }

    @Test
    void theServerSaysWhatItOffers() {
        var result = get(alice, "/api/server-info");

        assertThat(result).bodyJson().extractingPath("$.features").asMap().containsOnly(
            entry("publicPolls", true), entry("unlistedPolls", true),
            entry("approvalVoting", true), entry("majorityJudgment", true));
        assertThat(result).bodyJson().extractingPath("$.limits").asMap().containsOnly(
            entry("maxOptions", 20), entry("maxTitleLength", 200), entry("maxOptionLength", 100));
    }

    @Test
    void springsOwnErrorsAreProblemDocumentsToo() {
        var wrongMethod = delete(alice, "/api/polls");
        var nothingThere = get(alice, "/api/nothing-here");

        assertThat(wrongMethod).hasStatus(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(wrongMethod).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(nothingThere).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(nothingThere).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
    }

    // --- helpers --------------------------------------------------------------

    /** A voter is their cookie. Any well-formed token will do, as with the ones the server issues. */
    record Voter(String token) {

        private static final SecureRandom RANDOM = new SecureRandom();

        static Voter random() {
            var bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            return new Voter(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
        }

        Cookie cookie() {
            return new Cookie(VoterIdentity.COOKIE, token);
        }
    }

    String createPoll(Voter creator, String votingSystem, String visibility) {
        var result = post(creator, "/api/polls", """
            {"title": "Lunch?", "votingSystem": "%s", "visibility": "%s", "options": ["Ramen", "Tacos"]}
            """.formatted(votingSystem, visibility));
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    List<String> optionIds(String poll) {
        return JsonPath.read(body(get(alice, "/api/polls/" + poll)), "$.options[*].id");
    }

    MvcTestResult get(Voter voter, String uri) {
        return mvc.get().uri(uri).cookie(voter.cookie()).exchange();
    }

    MvcTestResult post(Voter voter, String uri, String json) {
        return mvc.post().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult put(Voter voter, String uri, String json) {
        return mvc.put().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult patch(Voter voter, String uri, String json) {
        return mvc.patch().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult delete(Voter voter, String uri) {
        return mvc.delete().uri(uri).cookie(voter.cookie()).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
