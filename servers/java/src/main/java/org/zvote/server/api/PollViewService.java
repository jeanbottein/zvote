package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.api.dto.MyBallotView;
import org.zvote.server.api.dto.OptionView;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.api.dto.PollUpdate;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.ballots.BallotBoxService;
import org.zvote.server.ballots.Tally;
import org.zvote.server.ballots.TallyService;
import org.zvote.server.identity.Voter;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollOption;
import org.zvote.server.polls.PollService;

import java.util.ArrayList;
import java.util.List;

/**
 * Composes a poll with its results and the caller's own ballot: it reads
 * polls, ballots and tallies, which know nothing of each other, and gives
 * their bytes a meaning through {@link BallotFormat}.
 *
 * A composition takes several queries, all read from one snapshot (a
 * repeatable read): at the default isolation, a fold landing between two of
 * them would make them disagree. The tallies are as of the last fold, a
 * moment after the last ballots (see TallyFolding).
 *
 * While a poll keeps its results back (Poll#showsResults), it has no
 * tallies, for anyone, its creator included: watching the counts move as
 * people vote shows what each of them chose. The number of ballots still
 * shows.
 */
@Service
public class PollViewService {

    private final PollService polls;
    private final BallotBoxService ballotBox;
    private final TallyService tallies;

    public PollViewService(PollService polls, BallotBoxService ballotBox, TallyService tallies) {
        this.polls = polls;
        this.ballotBox = ballotBox;
        this.tallies = tallies;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PollView view(Poll poll, Voter voter) {
        var options = polls.optionsOf(poll);
        var results = results(poll, options);
        return new PollView(
            poll.shareToken(),
            poll.joinCode(),
            poll.title(),
            poll.votingSystem(),
            poll.visibility(),
            poll.showVoterNames(),
            poll.resultsShown(),
            poll.resultsAfterBallots(),
            poll.createdAt(),
            poll.closedAt(),
            polls.expiryOf(poll),
            poll.isCreatedBy(voter.id()),
            results.totalBallots(),
            results.options(),
            results.voterNames(),
            results.moreVoterNames(),
            myBallot(poll, options, voter));
    }

    /** What the poll's watchers receive, read afresh: updates are computed after the fact. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PollUpdate update(Long pollId) {
        var poll = polls.get(pollId);
        return results(poll, polls.optionsOf(poll));
    }

    public PollSummary summary(Poll poll, Voter voter) {
        return new PollSummary(
            poll.shareToken(),
            poll.title(),
            poll.votingSystem(),
            poll.visibility(),
            poll.createdAt(),
            poll.closedAt(),
            poll.isCreatedBy(voter.id()));
    }

    private PollUpdate results(Poll poll, List<PollOption> options) {
        var tally = tallies.tallyOf(poll.id());
        var shown = poll.showsResults(tally.ballots());
        var optionViews = new ArrayList<OptionView>(options.size());
        for (int position = 0; position < options.size(); position++) {
            var option = options.get(position);
            optionViews.add(shown
                ? tallied(poll, option, tally, position)
                : new OptionView(BallotFormat.idOf(option), option.label(), null, null));
        }
        if (!poll.showVoterNames()) {
            return new PollUpdate(poll.closedAt(), tally.ballots(), optionViews, null, false);
        }
        var names = polls.voterNamesOf(poll);
        return new PollUpdate(poll.closedAt(), tally.ballots(), optionViews, names.names(), names.more());
    }

    private static OptionView tallied(Poll poll, PollOption option, Tally tally, int position) {
        var id = BallotFormat.idOf(option);
        return switch (poll.votingSystem()) {
            case APPROVAL -> new OptionView(id, option.label(), BallotFormat.approvals(tally, position), null);
            case MAJORITY_JUDGMENT ->
                new OptionView(id, option.label(), null, BallotFormat.judgmentCounts(tally, position));
        };
    }

    private MyBallotView myBallot(Poll poll, List<PollOption> options, Voter voter) {
        var choices = ballotBox.choicesOf(poll.id(), voter.ballotKey(poll.id()));
        if (choices == null) {
            return null;
        }
        var voterName = poll.showVoterNames()
            ? polls.voterNameOf(poll, voter.nameKey(poll.id())).orElse(null)
            : null;
        return switch (poll.votingSystem()) {
            case APPROVAL -> new MyBallotView(BallotFormat.decodeApprovals(choices, options), null, voterName);
            case MAJORITY_JUDGMENT ->
                new MyBallotView(null, BallotFormat.decodeJudgments(choices, options), voterName);
        };
    }
}
