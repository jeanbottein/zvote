package org.zvote.server.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

/** A server can offer less than everything: it says so, and refuses the rest. */
@SpringBootTest(properties = {"zvote.features.approval-voting=false", "zvote.features.unlisted-polls=false"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ServerFeaturesTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void itSaysWhatItOffers() {
        var result = mvc.get().uri("/api/server-info").exchange();

        assertThat(result).bodyJson().extractingPath("$.features").asMap().containsOnly(
            entry("publicPolls", true), entry("unlistedPolls", false),
            entry("approvalVoting", false), entry("majorityJudgment", true));
    }

    @ParameterizedTest(name = "{0}, {1}")
    @CsvSource({
        "APPROVAL, PUBLIC, Choose a voting system this server offers.",
        "MAJORITY_JUDGMENT, UNLISTED, Choose a visibility this server offers.",
    })
    void itRefusesPollsItDoesNotOffer(String votingSystem, String visibility, String explanation) {
        var result = mvc.post().uri("/api/polls").contentType(MediaType.APPLICATION_JSON).content("""
            {"title": "Lunch?", "votingSystem": "%s", "visibility": "%s", "options": ["Ramen", "Tacos"]}
            """.formatted(votingSystem, visibility)).exchange();

        assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo(explanation);
    }
}
