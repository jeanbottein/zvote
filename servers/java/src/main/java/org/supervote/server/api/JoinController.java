package org.supervote.server.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.supervote.server.api.dto.PollSummary;
import org.supervote.server.identity.Voter;
import org.supervote.server.identity.VoterIdentity;
import org.supervote.server.polls.PollService;
import org.supervote.server.ratelimit.Network;

/** Joining a poll with the short code someone read out or showed on a screen. */
@RestController
public class JoinController {

    private final PollService polls;
    private final PollViewService views;

    JoinController(PollService polls, PollViewService views) {
        this.polls = polls;
        this.views = views;
    }

    @GetMapping("/api/join/{code}")
    public PollSummary join(@PathVariable String code,
                            @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter,
                            HttpServletRequest request) {
        return views.summary(polls.findByJoinCode(code, Network.of(request)), voter);
    }
}
