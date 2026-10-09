package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.zvote.server.identity.VoterIdentity;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A poll created for somebody else, handed to them: an agent makes the poll,
 * its person becomes its creator.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PollHandoverTest {

    @Autowired
    MockMvcTester mvc;

    final Cookie agent = voter();
    final Cookie person = voter();
    final Cookie stranger = voter();

    @Test
    void aPollAsksForNoHandoverUnlessItSaysSo() {
        var plain = createPoll(agent, false);

        assertThat(plain).bodyJson().extractingPath("$.handover").isNull();
    }

    @Test
    void theTokenComesWithTheAnswerThatCreatedThePoll() {
        var created = createPoll(agent, true);

        assertThat(created).hasStatus(HttpStatus.CREATED);
        assertThat(created).bodyJson().extractingPath("$.handover").asString().isNotBlank();
    }

    /** Reading the poll never carries the token, whoever asks. */
    @Test
    void readingThePollNeverCarriesTheToken() {
        var poll = idOf(createPoll(agent, true));

        assertThat(mvc.get().uri("/api/polls/" + poll).cookie(agent).exchange())
            .bodyJson().extractingPath("$.handover").isNull();
        assertThat(mvc.get().uri("/api/polls/" + poll).cookie(person).exchange())
            .bodyJson().extractingPath("$.handover").isNull();
    }

    @Test
    void whoeverBringsItBecomesTheCreator() {
        var created = createPoll(agent, true);
        var poll = idOf(created);
        var token = JsonPath.<String>read(body(created), "$.handover");

        var handed = handOver(person, poll, token);

        assertThat(handed).hasStatus(HttpStatus.OK);
        assertThat(handed).bodyJson().extractingPath("$.isMine").isEqualTo(true);
        assertThat(mvc.get().uri("/api/polls/" + poll).cookie(person).exchange())
            .bodyJson().extractingPath("$.isMine").isEqualTo(true);
    }

    @Test
    void andTheClientThatMadeItKeepsNothing() {
        var created = createPoll(agent, true);
        var poll = idOf(created);
        handOver(person, poll, JsonPath.read(body(created), "$.handover"));

        assertThat(close(agent, poll)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/polls/" + poll).cookie(agent).exchange())
            .bodyJson().extractingPath("$.isMine").isEqualTo(false);
        assertThat(close(person, poll)).hasStatus(HttpStatus.OK);
    }

    /** A link that leaked afterwards opens nothing. */
    @Test
    void theTokenWorksOnce() {
        var created = createPoll(agent, true);
        var poll = idOf(created);
        var token = JsonPath.<String>read(body(created), "$.handover");
        handOver(person, poll, token);

        var again = handOver(stranger, poll, token);

        assertThat(again).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(again).bodyJson().extractingPath("$.type").isEqualTo("/problems/handover-unavailable");
        assertThat(mvc.get().uri("/api/polls/" + poll).cookie(person).exchange())
            .bodyJson().extractingPath("$.isMine").isEqualTo(true);
    }

    @Test
    void anotherPollsTokenOpensNothing() {
        var mine = createPoll(agent, true);
        var other = createPoll(agent, true);

        var crossed = handOver(person, idOf(other), JsonPath.read(body(mine), "$.handover"));

        assertThat(crossed).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void aPollThatAskedForNoHandoverCannotBeTaken() {
        var plain = createPoll(agent, false);

        assertThat(handOver(person, idOf(plain), "AAAAAAAAAAAAAAAAAAAAAA")).hasStatus(HttpStatus.FORBIDDEN);
    }

    /** The token is signed, not stored, so a client retrying is told it again. */
    @Test
    void aRetriedCreationIsToldTheTokenAgain() {
        var first = mvc.post().uri("/api/polls").cookie(agent)
            .header("Idempotency-Key", "one-poll")
            .contentType(MediaType.APPLICATION_JSON).content(request(true)).exchange();

        var again = mvc.post().uri("/api/polls").cookie(agent)
            .header("Idempotency-Key", "one-poll")
            .contentType(MediaType.APPLICATION_JSON).content(request(true)).exchange();

        assertThat(idOf(again)).isEqualTo(idOf(first));
        assertThat(JsonPath.<String>read(body(again), "$.handover"))
            .isEqualTo(JsonPath.read(body(first), "$.handover"));
    }

    // --- helpers --------------------------------------------------------------

    static Cookie voter() {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return new Cookie(VoterIdentity.COOKIE, Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
    }

    static String request(boolean handover) {
        return """
            {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
             "options": ["Ramen", "Tacos"], "handover": %s}
            """.formatted(handover);
    }

    MvcTestResult createPoll(Cookie creator, boolean handover) {
        var result = mvc.post().uri("/api/polls").cookie(creator)
            .contentType(MediaType.APPLICATION_JSON).content(request(handover)).exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return result;
    }

    MvcTestResult handOver(Cookie taker, String poll, String token) {
        return mvc.post().uri("/api/polls/" + poll + "/creator").cookie(taker)
            .header(PollController.HANDOVER, token).exchange();
    }

    MvcTestResult close(Cookie voter, String poll) {
        return mvc.patch().uri("/api/polls/" + poll).cookie(voter)
            .contentType(MediaType.APPLICATION_JSON).content("{\"closed\": true}").exchange();
    }

    static String idOf(MvcTestResult result) {
        return JsonPath.read(body(result), "$.id");
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
