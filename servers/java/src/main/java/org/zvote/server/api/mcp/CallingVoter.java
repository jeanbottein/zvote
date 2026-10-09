package org.zvote.server.api.mcp;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;

/**
 * Who is calling a tool.
 *
 * MCP is served over HTTP under /api, so VoterIdentityFilter has already
 * resolved the caller onto the request by the time a tool runs: an agent is a
 * voter like any other, known by the bearer token it sends.
 */
@Component
class CallingVoter {

    Voter get() {
        var request = RequestContextHolder.getRequestAttributes();
        var voter = request == null
            ? null
            : request.getAttribute(VoterIdentity.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        if (voter == null) {
            throw new IllegalStateException("No voter on this request: MCP must be served under /api, "
                + "where VoterIdentityFilter runs.");
        }
        return (Voter) voter;
    }
}
