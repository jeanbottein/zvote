package org.supervote.server.api;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.supervote.server.api.ProblemTypeTest.assertProblem;
import static org.supervote.server.api.ProblemTypeTest.body;
import static org.supervote.server.api.ProblemTypeTest.voter;

/**
 * What one network may do in a day, through the API and the MCP tools alike:
 * create its share of polls, and try join codes until it has got too many
 * wrong. Each test calls from networks of its own.
 */
@SpringBootTest(properties = {
    "super-vote.rate-limits.polls-per-day=3",
    "super-vote.rate-limits.wrong-codes-in-a-row=5",
    "super-vote.rate-limits.wrong-codes-per-day=20"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RateLimitApiTest {

    private static final AtomicInteger NETWORKS = new AtomicInteger();

    @Autowired
    MockMvcTester mvc;

    final String office = newNetwork();
    final String home = newNetwork();
    final Cookie alice = voter();

    @Nested
    class CreatingPolls {

        @Test
        void aNetworkIsToldHowManyMoreItMayCreateToday() {
            var created = create(office, null);

            assertThat(created).hasStatus(HttpStatus.CREATED);
            assertThat(created).hasHeader("RateLimit-Policy", "\"polls\";q=3;w=86400");
            assertThat(created.getResponse().getHeader("RateLimit")).matches("\"polls\";r=2;t=\\d+");
        }

        @Test
        void aNetworkThatCreatedItsShareIsRefusedUntilItsDayEnds() {
            create(office, null);
            create(office, null);
            create(office, null);

            var refused = create(office, null);

            assertProblem(refused, HttpStatus.TOO_MANY_REQUESTS, "/problems/too-many-polls");
            assertThat(Long.parseLong(refused.getResponse().getHeader(HttpHeaders.RETRY_AFTER)))
                .isBetween(23 * 3600L, 24 * 3600L + 1);
            assertThat(refused).bodyJson().extractingPath("$.detail").isEqualTo(
                "3 polls have already been created today from this connection. To be fair to everyone, as "
                    + "super-vote's resources are limited, each connection can create 3 polls a day: you can "
                    + "create more in 24 hours.");
        }

        @Test
        void oneNetworksShareIsNotAnothers() {
            create(office, null);
            create(office, null);
            create(office, null);

            assertThat(create(home, null)).hasStatus(HttpStatus.CREATED);
        }

        @Test
        void anInvalidPollCostsNothing() {
            var oneOption = mvc.post().uri("/api/polls").with(from(office)).cookie(alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Ramen"]}
                    """)
                .exchange();
            assertThat(oneOption).hasStatus(HttpStatus.BAD_REQUEST);

            assertThat(create(office, null).getResponse().getHeader("RateLimit")).startsWith("\"polls\";r=2;");
        }

        /** A retry is no new poll: it answers the one it made, even once the network has none left. */
        @Test
        void aRetriedCreationIsNeverRefused() {
            var first = create(office, "lunch-1");
            create(office, "lunch-2");
            create(office, "lunch-3");

            var retried = create(office, "lunch-1");

            assertThat(retried).hasStatus(HttpStatus.CREATED);
            assertThat(JsonPath.<String>read(body(retried), "$.id")).isEqualTo(JsonPath.<String>read(body(first), "$.id"));
            assertThat(create(office, "lunch-4")).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        }

        @Test
        void anAgentGetsTheSameShare() {
            for (int poll = 0; poll < 3; poll++) {
                assertThat(isError(callTool(office, "create_poll", LUNCH))).isFalse();
            }

            var refused = callTool(office, "create_poll", LUNCH);

            assertThat(isError(refused)).isTrue();
            assertThat(text(refused)).contains("3 polls have already been created today from this connection.");
        }
    }

    @Nested
    class TryingJoinCodes {

        final String code = joinCodeOf(create(home, null));

        @Test
        void wrongCodesInARowBarANetworkFromCodesForADay() {
            tryWrongCodes(office, 5);

            var refused = join(office, code);

            assertProblem(refused, HttpStatus.TOO_MANY_REQUESTS, "/problems/too-many-wrong-codes");
            assertThat(Long.parseLong(refused.getResponse().getHeader(HttpHeaders.RETRY_AFTER)))
                .isBetween(23 * 3600L, 24 * 3600L + 1);
            assertThat(refused).bodyJson().extractingPath("$.detail").asString()
                .endsWith("refused for the next 24 hours, but links to polls still work.");
        }

        @Test
        void aBarredNetworkStillOpensPollsByTheirLinks() {
            var poll = JsonPath.<String>read(body(join(home, code)), "$.id");
            tryWrongCodes(office, 5);

            assertThat(mvc.get().uri("/api/polls/" + poll).with(from(office)).cookie(alice).exchange())
                .hasStatus(HttpStatus.OK);
        }

        /** A room sharing one connection, where a few people mistype the code on the screen. */
        @Test
        void aRightCodeEndsARunOfWrongOnes() {
            tryWrongCodes(office, 4);
            assertThat(join(office, code)).hasStatus(HttpStatus.OK);
            tryWrongCodes(office, 4);

            assertThat(join(office, code)).hasStatus(HttpStatus.OK);
        }

        /** A guesser slipping a right code in between still runs out. */
        @Test
        void wrongCodesAddUpOverTheDay() {
            for (int run = 0; run < 4; run++) {
                tryWrongCodes(office, 4);
                assertThat(join(office, code)).hasStatus(HttpStatus.OK);
            }
            tryWrongCodes(office, 4);

            assertThat(join(office, code)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        }

        @Test
        void oneNetworksWrongCodesAreNotAnothers() {
            tryWrongCodes(office, 5);

            assertThat(join(home, code)).hasStatus(HttpStatus.OK);
        }

        /** Too short, a letter codes leave out, or a poll's id: nothing that could be a code is a guess. */
        @Test
        void whatCannotBeACodeIsNoGuess() {
            for (var notACode : new String[]{"K7M-4Q", "K7M4QO", "R0JsGfPEiNuO7CoMMd_I5g", "K7M4QX9"}) {
                assertThat(join(office, notACode)).hasStatus(HttpStatus.NOT_FOUND);
                assertThat(join(office, notACode)).hasStatus(HttpStatus.NOT_FOUND);
            }

            assertThat(join(office, code)).hasStatus(HttpStatus.OK);
        }

        @Test
        void anAgentsWrongCodesCountToo() {
            for (int guess = 0; guess < 5; guess++) {
                var notFound = callTool(office, "read_poll", "{\"poll\": \"%s\"}".formatted(wrongCode(guess)));
                assertThat(text(notFound)).contains("No poll has this code.");
            }

            var refused = callTool(office, "read_poll", "{\"poll\": \"%s\"}".formatted(code));

            assertThat(isError(refused)).isTrue();
            assertThat(text(refused)).contains("Too many wrong codes were tried from this connection.");
        }

        private void tryWrongCodes(String network, int count) {
            for (int guess = 0; guess < count; guess++) {
                assertThat(join(network, wrongCode(guess))).hasStatus(HttpStatus.NOT_FOUND);
            }
        }

        /** Well-formed, and not this test's poll's: a code that leads nowhere. */
        private String wrongCode(int guess) {
            var wrong = "ZZZZZ" + "23456789ABCDEFGHJKMNPQRSTUVWXY".charAt(guess);
            return wrong.equals(code) ? "YYYYY" + wrong.charAt(5) : wrong;
        }
    }

    // --- helpers --------------------------------------------------------------

    private static final String LUNCH = "{\"title\": \"Lunch?\", \"options\": [\"Ramen\", \"Tacos\"]}";

    /** A documentation address (RFC 5737) no other test calls from. */
    private static String newNetwork() {
        return "198.51.100." + NETWORKS.incrementAndGet();
    }

    static RequestPostProcessor from(String network) {
        return request -> {
            request.setRemoteAddr(network);
            return request;
        };
    }

    MvcTestResult create(String network, String idempotencyKey) {
        var request = mvc.post().uri("/api/polls").with(from(network)).cookie(alice)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Ramen", "Tacos"]}
                """);
        return idempotencyKey == null ? request.exchange() : request.header("Idempotency-Key", idempotencyKey).exchange();
    }

    MvcTestResult join(String network, String code) {
        return mvc.get().uri("/api/join/" + code).with(from(network)).cookie(alice).exchange();
    }

    static String joinCodeOf(MvcTestResult created) {
        return JsonPath.read(body(created), "$.joinCode");
    }

    /** A tool's answer in its MCP envelope: refusals come back as errors, not as HTTP statuses. */
    String callTool(String network, String tool, String arguments) {
        var result = mvc.post().uri("/api/mcp").with(from(network)).cookie(alice)
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
            .content("""
                {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "%s", "arguments": %s}}
                """.formatted(tool, arguments))
            .exchange();
        assertThat(result).hasStatus(HttpStatus.OK);
        return unwrap(body(result));
    }

    /** A stateless server may answer as one event stream frame or as plain JSON. */
    static String unwrap(String body) {
        return body.lines()
            .filter(line -> line.startsWith("data:"))
            .map(line -> line.substring("data:".length()).strip())
            .findFirst()
            .orElse(body);
    }

    static boolean isError(String answer) {
        return Boolean.TRUE.equals(JsonPath.<Boolean>read(answer, "$.result.isError"));
    }

    static String text(String answer) {
        return JsonPath.read(answer, "$.result.content[0].text");
    }
}
