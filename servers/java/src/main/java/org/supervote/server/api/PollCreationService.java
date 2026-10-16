package org.supervote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.supervote.server.ballots.TallyService;
import org.supervote.server.polls.CreatePollRequest;
import org.supervote.server.polls.InvitationService;
import org.supervote.server.polls.Poll;
import org.supervote.server.polls.PollService;
import org.supervote.server.ratelimit.Network;
import org.supervote.server.statistics.Activity;
import org.supervote.server.statistics.StatisticsService;

/**
 * Creates a poll with its tallies, and its invitations if it takes them, in
 * one transaction: a poll never exists without them.
 */
@Service
public class PollCreationService {

    private final PollService polls;
    private final TallyService tallies;
    private final InvitationService invitations;
    private final StatisticsService statistics;

    public PollCreationService(PollService polls, TallyService tallies, InvitationService invitations,
                               StatisticsService statistics) {
        this.polls = polls;
        this.tallies = tallies;
        this.invitations = invitations;
        this.statistics = statistics;
    }

    @Transactional
    public Poll create(CreatePollRequest request, String creatorId, Network network) {
        var poll = polls.create(request, creatorId, network);
        tallies.open(poll.id(), polls.optionsOf(poll).size(), BallotFormat.choices(poll.votingSystem()));
        if (poll.invitationOnly()) {
            invitations.open(poll.id());
        }
        statistics.count(Activity.POLL);
        return poll;
    }
}
