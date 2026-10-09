package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.identity.Voter;
import org.zvote.server.live.PollStream;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollService;

import java.time.Duration;

/**
 * A change to a poll, counted and announced.
 *
 * Casting a ballot, closing a poll and deleting one each take three steps: the
 * change itself, folding the ballots into the tallies so the answer counts
 * them, and telling whoever is watching. Every way into the server - the HTTP
 * API and the MCP tools - goes through here, so that none of them can do the
 * first step and forget the other two.
 *
 * The folding happens after the change's transaction has committed, never
 * inside it: a fold is a transaction of its own and must see what was written.
 */
@Service
public class PollChangeService {

    /** Closing waits for every ballot cast before it to be folded in: final results are final. */
    private static final Duration FINAL_FOLD = Duration.ofSeconds(30);

    private final PollService polls;
    private final BallotService ballots;
    private final PollViewService views;
    private final PollStream stream;
    private final TallyFolding folding;

    PollChangeService(PollService polls, BallotService ballots, PollViewService views, PollStream stream,
                      TallyFolding folding) {
        this.polls = polls;
        this.ballots = ballots;
        this.views = views;
        this.stream = stream;
        this.folding = folding;
    }

    /**
     * The voter sees their ballot at once, and the tallies counting it unless
     * so many are arriving that the fold takes longer than it waits; watchers
     * hear of it as soon as it is folded in.
     */
    public Poll cast(String shareToken, CastBallotRequest ballot, Voter voter, String invitation) {
        var poll = ballots.cast(shareToken, ballot, voter, invitation);
        folding.fold();
        announce(poll);
        return poll;
    }

    public Poll close(String shareToken, String voterId) {
        var poll = polls.close(shareToken, voterId);
        folding.fold(FINAL_FOLD);
        announce(poll);
        return poll;
    }

    public void delete(String shareToken, String voterId) {
        stream.deleted(polls.delete(shareToken, voterId).id());
    }

    private void announce(Poll poll) {
        stream.changed(poll.id(), () -> views.update(poll.id()));
    }
}
