package org.supervote.server.api;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.supervote.server.common.SuperVoteProperties;
import org.supervote.server.ratelimit.RateLimits;

import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * /llms.txt (llmstxt.org): super-vote as an agent should read it. The web app
 * is JavaScript, of which an agent reading a page sees nothing, so this says
 * what super-vote is, where its API and its tools are, and its rules: the
 * same ApiRules the OpenAPI document and the MCP tools are written from.
 */
@RestController
class LlmsTxtController {

    private static final MediaType MARKDOWN = new MediaType("text", "markdown", StandardCharsets.UTF_8);
    private static final String REPOSITORY = "https://github.com/jeanbottein/super-vote";

    private final String text;

    LlmsTxtController(SuperVoteProperties settings, RateLimits limits) {
        this.text = composed(Objects.requireNonNullElse(settings.publicUrl(), ""),
            settings.limits().pollLifetimeDays(), limits);
    }

    @GetMapping("/llms.txt")
    ResponseEntity<String> llmsTxt() {
        return ResponseEntity.ok().contentType(MARKDOWN).body(text);
    }

    private static String composed(String base, int lifetimeDays, RateLimits limits) {
        return """
            # super-vote

            > Free, open-source live voting for groups deciding together, by majority
            > judgment or approval voting. No account needed: a poll is shared by its
            > link or its join code, and deleted %2$d days after it was created.

            People use the web app; agents use its API, which is the same services.
            The app's pages are JavaScript, so read and vote through the API rather
            than through a page:

            - A poll's link, %1$s/p/{id}, reads as GET %1$s/api/polls/{id}.
            - A join code, such as K7M-4QX, reads as GET %1$s/api/join/K7M4QX.
            - MCP, the same services as tools: %1$s/api/mcp (streamable HTTP, stateless).
            - The HTTP API, in OpenAPI 3.1: %1$s/v3/api-docs.

            Act for your person: create the polls they ask for, and cast a ballot only
            when they asked you to, with the choices they made. Each person votes for
            themselves.

            **Links people share.** What follows a link's "#" never reaches the server,
            so a client sends it in a header instead:

            - %1$s/p/{id}#invitation={token}: an invitation. Send its token in the
              Super-Vote-Invitation header (MCP: the "invitation" argument) to read
              the poll and to cast a ballot.
            - %1$s/p/{id}#handover={token}: a poll made for somebody. Sending its token
              to POST /api/polls/{id}/creator, in the Super-Vote-Handover header, makes
              the caller the poll's creator, once.

            %3$s

            ## Docs

            - [OpenAPI document](%1$s/v3/api-docs): every endpoint and shape, with these rules
            - [HTTP API guide](%4$s/blob/main/docs/API.md): the same, with examples

            ## Optional

            - [Architecture](%4$s/blob/main/docs/ARCHITECTURE.md): how super-vote counts, ranks and keeps ballots anonymous
            - [Source code](%4$s)
            """.formatted(base, lifetimeDays, rules(limits), REPOSITORY);
    }

    private static String rules(RateLimits limits) {
        return String.join("\n\n",
            "**Identity.** " + ApiRules.IDENTITY,
            "**Ballots.** " + ApiRules.BALLOTS,
            "**Invitations.** " + ApiRules.INVITATIONS,
            "**Results.** " + ApiRules.RESULTS,
            "**Closing.** " + ApiRules.CLOSING,
            "**Creating a poll for somebody else.** " + ApiRules.HANDOVER,
            "**Repeating a request.** " + ApiRules.IDEMPOTENCY,
            "**Fair use.** " + ApiRules.FAIR_USE + " " + """
                Here, a network can create %d polls a day, and is refused codes
                after %d wrong ones in a row, or %d in a day.""".formatted(
                limits.pollsPerDay(), limits.wrongCodesInARow(), limits.wrongCodesPerDay()),
            "**Errors.** " + ApiRules.ERRORS);
    }
}
