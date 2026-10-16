package org.supervote.server.api.mcp;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.supervote.server.identity.Voter;
import org.supervote.server.identity.VoterIdentity;
import org.supervote.server.ratelimit.Network;

/**
 * Who is calling a tool, and from where.
 *
 * MCP is served over HTTP under /api, so VoterIdentityFilter has already
 * resolved the caller onto the request by the time a tool runs: an agent is a
 * voter like any other, known by the bearer token it sends, and its network
 * gets the same share as anyone's.
 */
@Component
class CallingVoter {

    private static final String NOT_UNDER_API =
        "No voter on this request: MCP must be served under /api, where VoterIdentityFilter runs.";

    Voter get() {
        var voter = currentRequest().getAttribute(VoterIdentity.ATTRIBUTE);
        if (voter == null) {
            throw new IllegalStateException(NOT_UNDER_API);
        }
        return (Voter) voter;
    }

    Network network() {
        return Network.of(currentRequest());
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        throw new IllegalStateException(NOT_UNDER_API);
    }
}
