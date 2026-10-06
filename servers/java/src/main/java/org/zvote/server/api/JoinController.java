package org.zvote.server.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.polls.PollService;

/** Joining a poll with the short code someone read out or showed on a screen. */
@RestController
public class JoinController {

    private final PollService polls;
    private final PollViewService views;

    public JoinController(PollService polls, PollViewService views) {
        this.polls = polls;
        this.views = views;
    }

    @GetMapping("/api/join/{code}")
    public PollSummary join(@PathVariable String code,
                            @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return polls.findByJoinCode(code)
            .map(poll -> views.summary(poll, voter))
            .orElseThrow(() -> new ErrorResponseException(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, "No poll has this code. Check it with the person who shared it."), null));
    }
}
