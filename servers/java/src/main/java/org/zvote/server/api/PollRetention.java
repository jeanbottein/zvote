package org.zvote.server.api;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.zvote.server.ballots.BallotBoxService;
import org.zvote.server.live.PollStream;
import org.zvote.server.polls.InvitationService;
import org.zvote.server.polls.PollService;

/**
 * Deletes polls once their lifetime is over (zvote.limits.poll-lifetime-days)
 * and tells anyone still watching one, then removes the ballots, names and
 * invitations of every deleted poll, a batch at a time, so that no
 * transaction grows with the size of a poll. Runs every minute; tests turn it
 * off (zvote.retention-cron: "-") and call it themselves.
 */
@Component
class PollRetention {

    private static final int BATCH = 10_000;

    private final PollService polls;
    private final InvitationService invitations;
    private final BallotBoxService ballotBox;
    private final PollStream stream;

    PollRetention(PollService polls, InvitationService invitations, BallotBoxService ballotBox, PollStream stream) {
        this.polls = polls;
        this.invitations = invitations;
        this.ballotBox = ballotBox;
        this.stream = stream;
    }

    @Scheduled(cron = "${zvote.retention-cron:0 * * * * *}")
    void run() {
        polls.deleteExpired().forEach(stream::deleted);
        for (var pollId : polls.removedPolls()) {
            int removed;
            do {
                removed = ballotBox.removeSome(pollId, BATCH) + polls.removeSomeNames(pollId, BATCH)
                    + invitations.removeSome(pollId, BATCH);
            } while (removed > 0);
            polls.removalDone(pollId);
        }
    }
}
