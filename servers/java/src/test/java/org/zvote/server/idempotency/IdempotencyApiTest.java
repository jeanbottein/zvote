package org.zvote.server.idempotency;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.zvote.server.identity.VoterIdentity;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Sending a request twice, the way a client whose first attempt timed out does. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IdempotencyApiTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    IdempotencyService idempotency;

    @Autowired
    JdbcClient jdbc;

    final Cookie agent = voter();
    final Cookie somebodyElse = voter();

    @Test
    void oneKeyMakesOnePoll() {
        var first = createPoll(agent, "lunch-2026-10-09");
        var again = createPoll(agent, "lunch-2026-10-09");

        assertThat(first).hasStatus(HttpStatus.CREATED);
        assertThat(again).hasStatus(HttpStatus.CREATED);
        assertThat(idOf(again)).isEqualTo(idOf(first));
        assertThat(mine(agent)).containsExactly(idOf(first));
    }

    @Test
    void anotherKeyMakesAnotherPoll() {
        createPoll(agent, "lunch");
        createPoll(agent, "dinner");

        assertThat(mine(agent)).hasSize(2);
    }

    @Test
    void noKeyIsNoPromise() {
        createPoll(agent, null);
        createPoll(agent, null);

        assertThat(mine(agent)).hasSize(2);
    }

    /** Keys belong to the voter that sent them: one client cannot replay another's. */
    @Test
    void keysDoNotCrossVoters() {
        var mine = createPoll(agent, "lunch");
        var theirs = createPoll(somebodyElse, "lunch");

        assertThat(idOf(theirs)).isNotEqualTo(idOf(mine));
    }

    /** The answer is composed afresh, so a replay reads the poll as it is now. */
    @Test
    void aReplayIsNotAStaleReading() {
        var poll = idOf(createPoll(agent, "lunch"));
        mvc.patch().uri("/api/polls/" + poll).cookie(agent)
            .contentType(MediaType.APPLICATION_JSON).content("{\"closed\": true}").exchange();

        var again = createPoll(agent, "lunch");

        assertThat(again).bodyJson().extractingPath("$.closedAt").isNotNull();
    }

    @Test
    void oneKeyHandsEachPersonOneLink() {
        var poll = idOf(createPoll(agent, "poll"));

        assertThat(invite(agent, poll, "invite-zoe")).hasStatus(HttpStatus.CREATED);
        var again = invite(agent, poll, "invite-zoe");

        assertThat(again).hasStatus(HttpStatus.CREATED);
        assertThat(again).bodyJson().extractingPath("$.count").isEqualTo(1);
        assertThat(again).bodyJson().extractingPath("$.invitations[*].number").asList().containsExactly(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"a key with spaces",
        "01234567890123456789012345678901234567890123456789012345678901234567890"})
    void refusesAKeyItCannotStore(String key) {
        var result = createPoll(agent, key);

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.type").isEqualTo("/problems/invalid-request");
        assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("Idempotency-Key");
    }

    @Test
    void forgetsKeysOnceNobodyCouldBeRetrying() {
        createPoll(agent, "lunch");
        assertThat(keysKeptFor(agent)).isEqualTo(1);

        idempotency.forget(OffsetDateTime.now().plusDays(1));

        assertThat(keysKeptFor(agent)).isZero();
        createPoll(agent, "lunch");
        assertThat(mine(agent)).hasSize(2);
    }

    // --- helpers --------------------------------------------------------------

    static Cookie voter() {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return new Cookie(VoterIdentity.COOKIE, Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
    }

    MvcTestResult createPoll(Cookie voter, String key) {
        var request = mvc.post().uri("/api/polls").cookie(voter)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"], "invitationOnly": true}
                """);
        return key == null ? request.exchange() : request.header(IdempotencyService.HEADER, key).exchange();
    }

    MvcTestResult invite(Cookie voter, String poll, String key) {
        return mvc.post().uri("/api/polls/" + poll + "/invitations").cookie(voter)
            .header(IdempotencyService.HEADER, key)
            .contentType(MediaType.APPLICATION_JSON).content("{\"label\": \"Zoe\"}")
            .exchange();
    }

    List<String> mine(Cookie voter) {
        return JsonPath.read(body(mvc.get().uri("/api/polls/mine").cookie(voter).exchange()), "$[*].id");
    }

    int keysKeptFor(Cookie voter) {
        return jdbc.sql("SELECT COUNT(*) FROM idempotent_request WHERE voter_id = :voter")
            .param("voter", VoterIdentity.voterIdOf(voter.getValue()))
            .query(Integer.class)
            .single();
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
