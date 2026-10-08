package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.ballots.TallyService;
import org.zvote.server.polls.CreatePollRequest;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollService;

/** Creates a poll with its tallies, in one transaction: a poll never exists without them. */
@Service
public class PollCreationService {

    private final PollService polls;
    private final TallyService tallies;

    public PollCreationService(PollService polls, TallyService tallies) {
        this.polls = polls;
        this.tallies = tallies;
    }

    @Transactional
    public Poll create(CreatePollRequest request, String creatorId) {
        var poll = polls.create(request, creatorId);
        tallies.open(poll.id(), polls.optionsOf(poll).size(), BallotFormat.choices(poll.votingSystem()));
        return poll;
    }
}
