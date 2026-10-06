package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.zvote.server.api.PollApiTest.body;

/** A server can offer more or less than the default: it says so, and refuses the rest. */
@SpringBootTest(properties = {"zvote.features.approval-voting=false", "zvote.features.public-polls=true"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ServerFeaturesTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void itSaysWhatItOffers() {
        var result = mvc.get().uri("/api/server-info").exchange();

        assertThat(result).bodyJson().extractingPath("$.features").asMap().containsOnly(
            entry("publicPolls", true), entry("unlistedPolls", true),
            entry("approvalVoting", false), entry("majorityJudgment", true));
    }

    @Test
    void itRefusesPollsItDoesNotOffer() {
        var result = create("APPROVAL", "PUBLIC");

        assertThat(result.getResponse().getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(JsonPath.<String>read(body(result), "$.detail")).isEqualTo("Choose a voting system this server offers.");
    }

    @Test
    void publicPollsAreListedAndUnlistedOnesAreNot() {
        var listed = JsonPath.<String>read(body(create("MAJORITY_JUDGMENT", "PUBLIC")), "$.id");
        var unlisted = JsonPath.<String>read(body(create("MAJORITY_JUDGMENT", "UNLISTED")), "$.id");

        var ids = JsonPath.<List<String>>read(body(mvc.get().uri("/api/polls").exchange()), "$[*].id");

        assertThat(ids).contains(listed).doesNotContain(unlisted);
    }

    private MvcTestResult create(String votingSystem, String visibility) {
        return mvc.post().uri("/api/polls").contentType(MediaType.APPLICATION_JSON).content("""
            {"title": "Lunch?", "votingSystem": "%s", "visibility": "%s", "options": ["Ramen", "Tacos"]}
            """.formatted(votingSystem, visibility)).exchange();
    }
}
