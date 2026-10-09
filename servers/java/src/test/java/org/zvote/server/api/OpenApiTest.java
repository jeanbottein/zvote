package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledInNativeImage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/** What a machine client reads to learn this API. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping handlers;

    @Test
    void describesEveryEndpointTheServerAnswers() {
        var document = body(mvc.get().uri("/v3/api-docs").exchange());

        assertThat(described(document)).containsAll(mapped());
    }

    @Test
    void saysWhatNoShapeCanSay() {
        var description = JsonPath.<String>read(body(mvc.get().uri("/v3/api-docs").exchange()), "$.info.description");

        assertThat(description)
            .contains("Authorization: Bearer")       // how a client that is not a browser is known
            .contains("counts as Bad")               // what an unrated option means
            .contains("Zvote-Invitation")            // how an invited voter is let in
            .contains("rank 1 is the winner")        // how to read the results
            .contains("Idempotency-Key")             // how to retry safely
            .contains("/problems/poll-closed");      // what to branch on when something fails
    }

    @Test
    void answersInYamlToo() {
        assertThat(mvc.get().uri("/v3/api-docs.yaml").exchange()).hasStatus(HttpStatus.OK);
    }

    /** The paths the controllers actually map, which the document must cover. */
    @DisabledInNativeImage // reads the handler mappings, which a native image resolves differently
    Set<String> mapped() {
        var paths = new TreeSet<String>();
        handlers.getHandlerMethods().keySet().forEach(mapping ->
            mapping.getPathPatternsCondition().getPatternValues().stream()
                .filter(path -> path.startsWith("/api/"))
                .forEach(paths::add));
        return paths;
    }

    static Set<String> described(String document) {
        return new TreeSet<>(JsonPath.<java.util.Map<String, Object>>read(document, "$.paths").keySet());
    }

    static String body(org.springframework.test.web.servlet.assertj.MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
