package org.supervote.server.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

import static org.assertj.core.api.Assertions.assertThat;
import static org.supervote.server.api.ProblemTypeTest.body;

/** What an agent finds at /llms.txt, where it looks first: a page of the web app shows it nothing. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LlmsTxtTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void isMarkdownForAnAgentToRead() {
        var result = mvc.get().uri("/llms.txt").exchange();

        assertThat(result).hasStatus(HttpStatus.OK);
        assertThat(result).hasContentTypeCompatibleWith("text/markdown");
        assertThat(result).doesNotContainHeader(HttpHeaders.SET_COOKIE);
        assertThat(body(result)).startsWith("# super-vote\n\n> ");
    }

    @Test
    void saysWhereEverythingIs() {
        assertThat(body(mvc.get().uri("/llms.txt").exchange()))
            .contains("GET https://super-vote.test/api/polls/{id}")
            .contains("GET https://super-vote.test/api/join/K7M4QX")
            .contains("https://super-vote.test/api/mcp")
            .contains("[OpenAPI document](https://super-vote.test/v3/api-docs)");
    }

    @Test
    void saysTheRulesTheApiKeeps() {
        assertThat(body(mvc.get().uri("/llms.txt").exchange()))
            .contains("cast a ballot only\nwhen they asked you to")
            .contains("Super-Vote-Invitation")
            .contains("counts as Bad")
            .contains("can create 1000000 polls a day")
            .contains("/problems/too-many-wrong-codes");
    }
}
