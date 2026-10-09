package org.zvote.server.identity;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How a client that is not a browser identifies itself: it asks for a voter
 * token and sends it as a bearer token.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VoterIdentityApiTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void mintsATokenAndTakesNoCookie() {
        var result = mvc.post().uri("/api/voters").exchange();

        assertThat(result).hasStatus(HttpStatus.CREATED);
        assertThat(result).doesNotContainHeader(HttpHeaders.SET_COOKIE);
        assertThat(result).bodyJson().extractingPath("$.token").asString().matches("[A-Za-z0-9_-]{43}");
    }

    @Test
    void mintsANewVoterEveryTime() {
        assertThat(mint()).isNotEqualTo(mint());
    }

    @Test
    void neverRevealsTheCallersOwnToken() {
        var mine = mint();

        var result = mvc.post().uri("/api/voters")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + mine)
            .cookie(new Cookie(VoterIdentity.COOKIE, mine))
            .exchange();

        assertThat(result).bodyJson().extractingPath("$.token").isNotEqualTo(mine);
    }

    @Test
    void aBearerTokenIsTheSameVoterAcrossRequests() {
        var agent = mint();
        var poll = createPoll(agent);

        assertThat(mvc.get().uri("/api/polls/" + poll).header(HttpHeaders.AUTHORIZATION, "Bearer " + agent).exchange())
            .bodyJson().extractingPath("$.isMine").isEqualTo(true);
        assertThat(mvc.get().uri("/api/polls/" + poll).exchange())
            .bodyJson().extractingPath("$.isMine").isEqualTo(false);
    }

    @Test
    void aBearerTokenTakesNoCookieBack() {
        var result = mvc.get().uri("/api/polls/mine")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + mint())
            .exchange();

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).doesNotContainHeader(HttpHeaders.SET_COOKIE);
    }

    @Test
    void aBearerTokenBeatsTheCookie() {
        var agent = mint();
        var poll = createPoll(agent);

        var result = mvc.get().uri("/api/polls/" + poll)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + agent)
            .cookie(new Cookie(VoterIdentity.COOKIE, mint()))
            .exchange();

        assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(true);
    }

    /** A browser starts afresh in silence; a client that chose to send a token must be told. */
    @ParameterizedTest
    @ValueSource(strings = {"Bearer not-a-token", "Bearer ", "Bearer AAAA", "", "Basic abc", "token"})
    void refusesATokenItCouldNotHaveIssued(String authorization) {
        var result = mvc.get().uri("/api/polls/mine")
            .header(HttpHeaders.AUTHORIZATION, authorization)
            .exchange();

        assertThat(result).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).hasHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("POST /api/voters");
    }

    @Test
    void replacesACookieItCouldNotHaveIssuedInSilence() {
        var result = mvc.get().uri("/api/polls/mine")
            .cookie(new Cookie(VoterIdentity.COOKIE, "not-a-token"))
            .exchange();

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).containsHeader(HttpHeaders.SET_COOKIE);
    }

    // --- helpers --------------------------------------------------------------

    String mint() {
        var result = mvc.post().uri("/api/voters").exchange();
        return JsonPath.read(body(result), "$.token");
    }

    String createPoll(String token) {
        var result = mvc.post().uri("/api/polls")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"]}
                """)
            .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    static String body(org.springframework.test.web.servlet.assertj.MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
