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
    public PollView view(Poll poll, String voterId) {
        var options = polls.optionsOf(poll);
        var results = results(poll, options);
        return new PollView(
            poll.shareToken(),
            poll.title(),
            poll.votingSystem(),
            poll.visibility(),
            poll.createdAt(),
            poll.closedAt(),
            poll.isCreatedBy(voterId),
            results.totalBallots(),
            results.options(),
            myBallot(poll, options, voterId));
    }

    /** What the poll's watchers receive, read afresh: updates are computed after the fact. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PollUpdate update(Long pollId) {
        var poll = polls.get(pollId);
        return results(poll, polls.optionsOf(poll));
    }

    public PollSummary summary(Poll poll, String voterId) {
        return new PollSummary(
            poll.shareToken(),
            poll.title(),
            poll.votingSystem(),
            poll.visibility(),
            poll.createdAt(),
            poll.closedAt(),
            poll.isCreatedBy(voterId));
    }

    private PollUpdate results(Poll poll, List<PollOption> options) {
        var optionIds = options.stream().map(PollOption::id).toList();
        return switch (poll.votingSystem()) {
            case APPROVAL -> {
                var tallies = approvals.tallies(poll.id(), optionIds);
                yield new PollUpdate(poll.closedAt(), approvals.ballotCount(poll.id()), options.stream()
                    .map(option -> new OptionView(idOf(option), option.label(), tallies.get(option.id()), null))
                    .toList());
            }
            case MAJORITY_JUDGMENT -> {
                var tallies = judgments.tallies(poll.id(), optionIds);
                yield new PollUpdate(poll.closedAt(), judgments.ballotCount(poll.id()), options.stream()
                    .map(option -> new OptionView(idOf(option), option.label(), null, byWireName(tallies.get(option.id()))))
                    .toList());
            }
        };
    }

    private MyBallotView myBallot(Poll poll, List<PollOption> options, String voterId) {
        return switch (poll.votingSystem()) {
            case APPROVAL -> {
                var approved = approvals.ballotOf(poll.id(), voterId);
                yield approved.isEmpty() ? null : new MyBallotView(
                    options.stream().filter(option -> approved.contains(option.id())).map(PollViewService::idOf).toList(),
                    null);
            }
            case MAJORITY_JUDGMENT -> {
                var mentions = judgments.ballotOf(poll.id(), voterId);
                var byOption = new LinkedHashMap<String, String>();
                for (var option : options) {
                    var mention = mentions.get(option.id());
                    if (mention != null) {
                        byOption.put(idOf(option), mention.wireName());
                    }
                }
                yield byOption.isEmpty() ? null : new MyBallotView(null, byOption);
            }
        };
    }

    /** Keeps the tallies' worst-to-best order. */
    private static Map<String, Long> byWireName(Map<Mention, Long> tallies) {
        var byWireName = new LinkedHashMap<String, Long>();
        tallies.forEach((mention, count) -> byWireName.put(mention.wireName(), count));
        return byWireName;
    }

    private static String idOf(PollOption option) {
        return String.valueOf(option.id());
    }
}
