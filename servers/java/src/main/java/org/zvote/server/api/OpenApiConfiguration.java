package org.zvote.server.api;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.zvote.server.common.ZVoteProperties;

import java.util.Optional;

/**
 * The API as a machine reads it, at /v3/api-docs (and /v3/api-docs.yaml).
 *
 * The shapes come from the controllers and their records, so the document
 * cannot drift from the code; what no shape can say is in the description,
 * from {@link ApiRules}, which the MCP tools are written from too.
 */
@Configuration(proxyBeanMethods = false)
class OpenApiConfiguration {

    @Bean
    OpenAPI zvoteApi(ZVoteProperties settings, Optional<BuildProperties> build) {
        return new OpenAPI().info(new Info()
            .title("zvote")
            .version(build.map(BuildProperties::getVersion).orElse("development"))
            .license(new License().name("AGPL-3.0-or-later"))
            .description("""
                Live voting by majority judgment or approval, for groups deciding
                together. A poll is the question; a ballot is one voter's answer.

                %s

                ## Casting a ballot

                %s

                ## Invitations

                %s

                ## Results

                %s

                ## Closing a poll

                %s

                ## Creating a poll for somebody else

                %s

                ## Repeating a request

                %s

                ## Errors

                %s
                """.formatted(ApiRules.IDENTITY, ApiRules.BALLOTS, ApiRules.INVITATIONS, ApiRules.RESULTS,
                ApiRules.CLOSING, ApiRules.HANDOVER, ApiRules.IDEMPOTENCY, ApiRules.ERRORS)));
    }
}
