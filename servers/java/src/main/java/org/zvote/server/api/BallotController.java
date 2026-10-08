package org.zvote.server.api;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.live.PollStream;

/**
 * Casting a ballot is a PUT: a voter has at most one ballot per poll, and
 * sending another replaces it. Revising and withdrawing are therefore the same
 * operation, and retries are harmless.
 */
@RestController
@RequestMapping("/api/polls/{id}/ballot")
public class BallotController {

    private final BallotService ballots;
    private final PollViewService views;
    private final PollStream stream;
    private final TallyFolding folding;

    BallotController(BallotService ballots, PollViewService views, PollStream stream, TallyFolding folding) {
        this.ballots = ballots;
        this.views = views;
        this.stream = stream;
        this.folding = folding;
    }

    /**
     * Watchers hear of the ballot once it is folded into the tallies, and of
     * the voter's name once it is committed. The voter sees their ballot at
     * once, and the tallies with it unless many ballots are arriving.
     */
    @PutMapping
    public PollView cast(@PathVariable String id,
                         @RequestBody CastBallotRequest ballot,
                         @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        var poll = ballots.cast(id, ballot, voter);
        folding.fold();
        stream.changed(poll.id(), () -> views.update(poll.id()));
        return views.view(poll, voter);
    }
}
