package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.api.dto.MyBallotView;
import org.zvote.server.api.dto.OptionView;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.api.dto.PollUpdate;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.approval.ApprovalBallotService;
import org.zvote.server.identity.Voter;
import org.zvote.server.judgment.JudgmentBallotService;
import org.zvote.server.judgment.Mention;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollOption;
import org.zvote.server.polls.PollService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Composes a poll with its results and the caller's own ballot.
 *
 * This is the one place that knows about polls and every voting system at
 * once, which is why it lives in the api package: polls stay ignorant of how
 * they are voted on, and each voting system stays ignorant of the others.
 *
 * A composition takes several queries, all read from one snapshot (a
 * repeatable read): at the default isolation, a ballot landing between the
 * tallies and the ballot count would make them disagree.
 *
 * While a poll keeps its results back (Poll#showsResults), it has no
 * tallies, for anyone, its creator included: watching the counts move as
 * people vote shows what each of them chose. The number of ballots still
 * shows.
 */
@Service
public class PollViewService {

    private final PollService polls;
    private final ApprovalBallotService approvals;
    private final JudgmentBallotService judgments;

    public PollViewService(PollService polls, ApprovalBallotService approvals, JudgmentBallotService judgments) {
        this.polls = polls;
        this.approvals = approvals;
        this.judgments = judgments;
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
        var optionIds = options.stream().map(PollOption::id).toList();
        var voterNames = poll.showVoterNames() ? polls.voterNamesOf(poll) : null;
        return switch (poll.votingSystem()) {
            case APPROVAL -> {
                var ballots = approvals.ballotCount(poll.id());
                var tallies = poll.showsResults(ballots) ? approvals.tallies(poll.id(), optionIds) : Map.<Long, Long>of();
                yield new PollUpdate(poll.closedAt(), ballots, options.stream()
                    .map(option -> new OptionView(idOf(option), option.label(), tallies.get(option.id()), null))
                    .toList(), voterNames);
            }
            case MAJORITY_JUDGMENT -> {
                var ballots = judgments.ballotCount(poll.id());
                var tallies = poll.showsResults(ballots)
                    ? judgments.tallies(poll.id(), optionIds)
                    : Map.<Long, Map<Mention, Long>>of();
                yield new PollUpdate(poll.closedAt(), ballots, options.stream()
                    .map(option -> new OptionView(idOf(option), option.label(), null, byWireName(tallies.get(option.id()))))
                    .toList(), voterNames);
            }
        };
    }

    private MyBallotView myBallot(Poll poll, List<PollOption> options, Voter voter) {
        var voterName = polls.voterNameOf(poll, voter.nameKey(poll.id())).orElse(null);
        var ballotKey = voter.ballotKey(poll.id());
        return switch (poll.votingSystem()) {
            case APPROVAL -> {
                var approved = approvals.ballotOf(poll.id(), ballotKey);
                yield approved.isEmpty() ? null : new MyBallotView(
                    options.stream().filter(option -> approved.contains(option.id())).map(PollViewService::idOf).toList(),
                    null,
                    voterName);
            }
            case MAJORITY_JUDGMENT -> {
                var mentions = judgments.ballotOf(poll.id(), ballotKey);
                var byOption = new LinkedHashMap<String, String>();
                for (var option : options) {
                    var mention = mentions.get(option.id());
                    if (mention != null) {
                        byOption.put(idOf(option), mention.wireName());
                    }
                }
                yield byOption.isEmpty() ? null : new MyBallotView(null, byOption, voterName);
            }
        };
    }

    /** Keeps the tallies' worst-to-best order. Null while the results are hidden. */
    private static Map<String, Long> byWireName(Map<Mention, Long> tallies) {
        if (tallies == null) {
            return null;
        }
        var byWireName = new LinkedHashMap<String, Long>();
        tallies.forEach((mention, count) -> byWireName.put(mention.wireName(), count));
        return byWireName;
    }

    private static String idOf(PollOption option) {
        return String.valueOf(option.id());
    }
}
