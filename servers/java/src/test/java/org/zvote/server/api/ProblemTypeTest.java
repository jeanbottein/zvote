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
 * The machine-readable half of every problem document, in one table: an agent
 * branches on "type", never on the sentence in "detail".
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProblemTypeTest {

    @Autowired
    MockMvcTester mvc;

    final Cookie alice = voter();
    final Cookie bob = voter();
    final Cookie carol = voter();

    @Test
    void aRuleBroken() {
        var oneOption = mvc.post().uri("/api/polls").cookie(alice)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Ramen"]}
                """)
            .exchange();

        assertProblem(oneOption, HttpStatus.BAD_REQUEST, "/problems/invalid-request");
    }

    @Test
    void aBodyThatCannotBeRead() {
        var broken = mvc.post().uri("/api/polls").cookie(alice)
            .contentType(MediaType.APPLICATION_JSON).content("{").exchange();

        assertProblem(broken, HttpStatus.BAD_REQUEST, "/problems/invalid-request");
    }

    @Test
    void noSuchPoll() {
        assertProblem(mvc.get().uri("/api/polls/nothing-here").cookie(alice).exchange(),
            HttpStatus.NOT_FOUND, "/problems/poll-not-found");
    }

    @Test
    void notTheCreator() {
        var poll = createPoll(alice, false);

        var closing = mvc.patch().uri("/api/polls/" + poll).cookie(bob)
            .contentType(MediaType.APPLICATION_JSON).content("{\"closed\": true}").exchange();

        assertProblem(closing, HttpStatus.FORBIDDEN, "/problems/not-poll-creator");
    }

    @Test
    void notInvited() {
        var poll = createPoll(alice, true);

        assertProblem(cast(bob, poll, null), HttpStatus.FORBIDDEN, "/problems/not-invited");
    }

    @Test
    void aPollClosedForGood() {
        var poll = createPoll(alice, false);
        mvc.patch().uri("/api/polls/" + poll).cookie(alice)
            .contentType(MediaType.APPLICATION_JSON).content("{\"closed\": true}").exchange();

        assertProblem(cast(bob, poll, null), HttpStatus.CONFLICT, "/problems/poll-closed");
    }

    @Test
    void anInvitationAlreadyVotedWith() {
        var poll = createPoll(alice, true);
        var invitation = invite(alice, poll);
        assertThat(cast(bob, poll, invitation)).hasStatus(HttpStatus.OK);

        assertProblem(cast(carol, poll, invitation), HttpStatus.CONFLICT, "/problems/invitation-used");
    }

    /**
     * Spring MVC's own refusals are problem documents too, but carry no type:
     * RFC 9457 reads a missing one as about:blank, "no more than the status".
     */
    @Test
    void springsOwnRefusalsCarryNoType() {
        var wrongMethod = mvc.post().uri("/api/polls/mine").cookie(alice).exchange();

        assertThat(wrongMethod).hasStatus(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(wrongMethod).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(wrongMethod).bodyJson().doesNotHavePath("$.type");
    }

    // --- helpers --------------------------------------------------------------

    static void assertProblem(MvcTestResult result, HttpStatus status, String type) {
        assertThat(result).hasStatus(status);
        assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.type").isEqualTo(type);
        assertThat(result).bodyJson().extractingPath("$.detail").asString().isNotBlank();
    }

    static Cookie voter() {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return new Cookie(VoterIdentity.COOKIE, Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
    }

    String createPoll(Cookie creator, boolean invitationOnly) {
        var result = mvc.post().uri("/api/polls").cookie(creator)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"], "invitationOnly": %s}
                """.formatted(invitationOnly))
            .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    String invite(Cookie creator, String poll) {
        var result = mvc.post().uri("/api/polls/" + poll + "/invitations").cookie(creator)
            .contentType(MediaType.APPLICATION_JSON).content("{}").exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.invitations[0].token");
    }

    MvcTestResult cast(Cookie voter, String poll, String invitation) {
        var request = mvc.put().uri("/api/polls/" + poll + "/ballot").cookie(voter)
            .contentType(MediaType.APPLICATION_JSON).content("{\"approvedOptionIds\": []}");
        return invitation == null ? request.exchange() : request.header("Zvote-Invitation", invitation).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
