package org.zvote.server.api.mcp;

import com.jayway.jsonpath.JsonPath;
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

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * zvote as tools: an agent runs a vote among agents, over the same services
 * the HTTP API uses.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class McpToolsTest {

    @Autowired
    MockMvcTester mvc;

    @Test
    void offerEverythingAVoteNeeds() {
        var tools = JsonPath.<List<String>>read(rpc(null, "tools/list", "{}"), "$.result.tools[*].name");

        assertThat(tools).containsExactlyInAnyOrder("create_poll", "read_poll", "poll_results", "cast_ballot",
            "invite", "list_invitations", "close_poll", "delete_poll", "list_my_polls");
    }

    /** What an agent cannot guess from a schema is in the descriptions. */
    @Test
    void sayWhatTheSchemasCannot() {
        var listed = rpc(null, "tools/list", "{}");

        assertThat(describing(listed, "cast_ballot")).contains("counts as Bad");
        assertThat(describing(listed, "create_poll")).contains("joinCode");
        assertThat(describing(listed, "invite")).contains("link");
        assertThat(describing(listed, "poll_results")).contains("ex aequo");
        assertThat(describing(listed, "close_poll")).contains("cannot be reopened");
    }

    @Test
    void runAVoteFromStartToFinish() {
        var organiser = mint();
        var poll = call(organiser, "create_poll", """
            {"title": "Which database?", "options": ["PostgreSQL", "SQLite"],
             "invitationOnly": true, "resultsShown": "LIVE"}
            """);
        var id = JsonPath.<String>read(poll, "$.id");
        List<String> options = JsonPath.read(poll, "$.options[*].id");

        var invitations = call(organiser, "invite", """
            {"poll": "%s", "labels": ["agent-a", "agent-b"]}
            """.formatted(id));
        List<String> tokens = JsonPath.read(invitations, "$.invitations[*].token");
        assertThat(JsonPath.<List<String>>read(invitations, "$.invitations[*].link"))
            .allMatch(link -> link.startsWith("https://zvote.test/p/" + id + "#invitation="));

        for (var voter : List.of(
            Map.of("token", tokens.get(0), "first", "Excellent", "second", "Bad"),
            Map.of("token", tokens.get(1), "first", "VeryGood", "second", "Passable"))) {
            call(mint(), "cast_ballot", """
                {"poll": "%s", "invitation": "%s", "judgments": {"%s": "%s", "%s": "%s"}}
                """.formatted(id, voter.get("token"), options.get(0), voter.get("first"),
                options.get(1), voter.get("second")));
        }

        var decision = call(organiser, "poll_results", "{\"poll\": \"%s\"}".formatted(id));

        assertThat(JsonPath.<List<String>>read(decision, "$.winner")).containsExactly("PostgreSQL");
        assertThat(JsonPath.<Integer>read(decision, "$.results.totalBallots")).isEqualTo(2);
        assertThat(JsonPath.<List<Integer>>read(decision, "$.results.options[*].rank")).containsExactly(1, 2);
    }

    /** The ballot is folded into the tallies before the answer, as over HTTP. */
    @Test
    void countTheBallotTheyJustCast() {
        var voter = mint();
        var poll = call(voter, "create_poll", """
            {"title": "Lunch?", "options": ["Ramen", "Tacos"], "votingSystem": "APPROVAL", "resultsShown": "LIVE"}
            """);
        var id = JsonPath.<String>read(poll, "$.id");
        List<String> options = JsonPath.read(poll, "$.options[*].id");

        var after = call(voter, "cast_ballot", """
            {"poll": "%s", "approvedOptionIds": ["%s"]}
            """.formatted(id, options.getFirst()));

        assertThat(JsonPath.<Integer>read(after, "$.totalBallots")).isEqualTo(1);
        assertThat(JsonPath.<List<Integer>>read(after, "$.options[*].approvalCount")).containsExactly(1, 0);
    }

    @Test
    void takeAJoinCodeWhereAnIdWouldDo() {
        var voter = mint();
        var poll = call(voter, "create_poll", "{\"title\": \"Lunch?\", \"options\": [\"Ramen\", \"Tacos\"]}");
        var code = JsonPath.<String>read(poll, "$.joinCode");

        var read = call(voter, "read_poll", "{\"poll\": \"%s\"}".formatted(code));

        assertThat(JsonPath.<String>read(read, "$.id")).isEqualTo(JsonPath.<String>read(poll, "$.id"));
    }

    @Test
    void handBackTheSentenceAPersonWouldRead() {
        var voter = mint();
        var poll = call(voter, "create_poll", "{\"title\": \"Lunch?\", \"options\": [\"Ramen\", \"Tacos\"]}");
        var id = JsonPath.<String>read(poll, "$.id");
        call(voter, "close_poll", "{\"poll\": \"%s\"}".formatted(id));

        var refused = rpc(voter, "tools/call", """
            {"name": "cast_ballot", "arguments": {"poll": "%s", "judgments": {}}}
            """.formatted(id));

        assertThat(JsonPath.<Boolean>read(refused, "$.result.isError")).isTrue();
        assertThat(JsonPath.<String>read(refused, "$.result.content[0].text"))
            .contains("This poll is closed and no longer accepts ballots.");
    }

    /** The caller is a voter like any other, known by the token it sends. */
    @Test
    void knowOneAgentFromAnother() {
        var mine = mint();
        var theirs = mint();
        call(mine, "create_poll", "{\"title\": \"Mine\", \"options\": [\"A\", \"B\"]}");

        assertThat(JsonPath.<List<String>>read(call(mine, "list_my_polls", "{}"), "$[*].title"))
            .containsExactly("Mine");
        assertThat(JsonPath.<List<String>>read(call(theirs, "list_my_polls", "{}"), "$[*]")).isEmpty();
    }

    // --- helpers --------------------------------------------------------------

    String mint() {
        return JsonPath.read(body(mvc.post().uri("/api/voters").exchange()), "$.token");
    }

    /** The JSON a tool answered with, unwrapped from its MCP envelope. */
    String call(String token, String tool, String arguments) {
        var answer = rpc(token, "tools/call",
            "{\"name\": \"%s\", \"arguments\": %s}".formatted(tool, arguments));
        assertThat(JsonPath.<Boolean>read(answer, "$.result.isError"))
            .withFailMessage(() -> tool + " refused: " + JsonPath.read(answer, "$.result.content[0].text"))
            .isNotEqualTo(true);
        return JsonPath.read(answer, "$.result.content[0].text");
    }

    String rpc(String token, String method, String params) {
        var request = mvc.post().uri("/api/mcp")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
            .content("{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"%s\", \"params\": %s}"
                .formatted(method, params));
        var result = token == null
            ? request.exchange()
            : request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token).exchange();
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

    static String describing(String listed, String tool) {
        List<String> found = JsonPath.read(listed, "$.result.tools[?(@.name == '" + tool + "')].description");
        return found.getFirst();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
