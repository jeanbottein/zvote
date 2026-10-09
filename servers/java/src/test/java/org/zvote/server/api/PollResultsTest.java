package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
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
import org.zvote.server.identity.VoterIdentity;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Results a client asks for, rather than watches: the same answer, cacheable. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PollResultsTest {

    @Autowired
    MockMvcTester mvc;

    final Cookie alice = voter();
    final Cookie bob = voter();

    @Test
    void areWhatAWatcherWouldReceive() {
        var poll = createPoll(alice, "LIVE", null);
        approve(bob, poll, optionIds(poll).getFirst());

        var results = mvc.get().uri("/api/polls/" + poll + "/results").cookie(alice).exchange();

        assertThat(results).hasStatus(HttpStatus.OK);
        assertThat(results).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
        assertThat(results).bodyJson().extractingPath("$.closedAt").isNull();
        assertThat(results).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(List.of(1, 0));
        assertThat(results).bodyJson().extractingPath("$").asMap()
            .containsOnlyKeys("closedAt", "totalBallots", "options", "voterNames", "moreVoterNames");
    }

    /** No isMine, no myBallot, no admission: one answer serves every reader. */
    @Test
    void sayTheSameThingToEveryone() {
        var poll = createPoll(alice, "LIVE", null);
        approve(bob, poll, optionIds(poll).getFirst());

        assertThat(body(results(alice, poll))).isEqualTo(body(results(bob, poll)));
    }

    @Test
    void canBeCachedForAMoment() {
        var poll = createPoll(alice, "LIVE", null);

        assertThat(results(alice, poll)).hasHeader(HttpHeaders.CACHE_CONTROL, "max-age=1");
    }

    /** Results kept back are kept back here too, for the creator as for anyone. */
    @Test
    void keepBackWhatThePollKeepsBack() {
        var poll = createPoll(alice, "AFTER_CLOSING", null);
        approve(bob, poll, optionIds(poll).getFirst());

        var kept = results(alice, poll);

        assertThat(kept).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
        assertThat(kept).bodyJson().extractingPath("$.options[*].approvalCount").asList().containsOnlyNulls();
    }

    @Test
    void showWhatThePollShows() {
        var poll = createPoll(alice, "AFTER_BALLOTS", 3L);
        approve(bob, poll, optionIds(poll).getFirst());

        assertThat(results(alice, poll)).bodyJson().extractingPath("$.options[0].approvalCount").isNull();
    }

    /** The winner is rank 1, so an agent need not re-derive the GMJ tie-break. */
    @Test
    void sayWhichOptionWins() {
        var poll = createJudgmentPoll(alice);
        var options = optionIds(poll);
        judge(bob, poll, options.get(0), "Excellent", options.get(1), "Bad");

        var results = results(alice, poll);

        assertThat(results).bodyJson().extractingPath("$.options[*].rank").isEqualTo(List.of(1, 2));
        assertThat(results).bodyJson().extractingPath("$.options[*].majorityMention")
            .isEqualTo(List.of("Excellent", "Bad"));
        assertThat(results).bodyJson().extractingPath("$.options[0].score").asMap()
            .containsOnlyKeys("numerator", "denominator");
        assertThat(results).bodyJson().extractingPath("$.options[0]").asMap()
            .containsOnlyKeys("id", "label", "approvalCount", "judgmentCounts", "rank", "majorityMention", "score");
    }

    /** Options stay in the poll's own order: rank says which is first, not position. */
    @Test
    void keepThePollsOwnOrder() {
        var poll = createJudgmentPoll(alice);
        var options = optionIds(poll);
        judge(bob, poll, options.get(0), "Bad", options.get(1), "Excellent");

        var results = results(alice, poll);

        assertThat(results).bodyJson().extractingPath("$.options[*].label").isEqualTo(List.of("Ramen", "Tacos"));
        assertThat(results).bodyJson().extractingPath("$.options[*].rank").isEqualTo(List.of(2, 1));
    }

    /** A ranking says who is winning as plainly as the tallies do. */
    @Test
    void keepBackTheRankingTooWhileResultsAreHeldBack() {
        var poll = createPoll(alice, "AFTER_CLOSING", null);
        approve(bob, poll, optionIds(poll).getFirst());

        var kept = results(alice, poll);

        assertThat(kept).bodyJson().extractingPath("$.options[*].rank").asList().containsOnlyNulls();
        assertThat(kept).bodyJson().extractingPath("$.options[*].majorityMention").asList().containsOnlyNulls();
        assertThat(kept).bodyJson().extractingPath("$.options[*].score").asList().containsOnlyNulls();
    }

    @Test
    void sayNoPollHasThatId() {
        var missing = mvc.get().uri("/api/polls/nothing-here/results").cookie(alice).exchange();

        assertThat(missing).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(missing).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(missing).bodyJson().extractingPath("$.type").isEqualTo("/problems/poll-not-found");
    }

    // --- helpers --------------------------------------------------------------

    static Cookie voter() {
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return new Cookie(VoterIdentity.COOKIE, Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
    }

    String createPoll(Cookie creator, String resultsShown, Long after) {
        var result = mvc.post().uri("/api/polls").cookie(creator)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"], "resultsShown": "%s", "resultsAfterBallots": %s}
                """.formatted(resultsShown, after))
            .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    String createJudgmentPoll(Cookie creator) {
        var result = mvc.post().uri("/api/polls").cookie(creator)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title": "Lunch?", "votingSystem": "MAJORITY_JUDGMENT", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"], "resultsShown": "LIVE"}
                """)
            .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    MvcTestResult judge(Cookie voter, String poll, String first, String firstMention, String second,
                        String secondMention) {
        return mvc.put().uri("/api/polls/" + poll + "/ballot").cookie(voter)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"judgments\": {\"" + first + "\": \"" + firstMention + "\", \""
                + second + "\": \"" + secondMention + "\"}}")
            .exchange();
    }

    List<String> optionIds(String poll) {
        return JsonPath.read(body(mvc.get().uri("/api/polls/" + poll).cookie(alice).exchange()), "$.options[*].id");
    }

    MvcTestResult approve(Cookie voter, String poll, String option) {
        return mvc.put().uri("/api/polls/" + poll + "/ballot").cookie(voter)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"approvedOptionIds\": [\"" + option + "\"]}")
            .exchange();
    }

    MvcTestResult results(Cookie voter, String poll) {
        return mvc.get().uri("/api/polls/" + poll + "/results").cookie(voter).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
