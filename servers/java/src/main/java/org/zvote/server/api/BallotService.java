package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.approval.ApprovalBallotService;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.judgment.JudgmentBallotService;
import org.zvote.server.judgment.Mention;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollOption;
import org.zvote.server.polls.PollService;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Casts a ballot in the poll's voting system, after checking it has the right
 * shape and only this poll's options.
 *
 * One transaction holds the poll's lock from the check that it is open to the
 * saved ballot, so a poll closed or deleted at the same moment either waits
 * for the ballot or refuses it: a ballot is never counted after closing, nor
 * reported counted on a poll being deleted.
 */
@Service
public class BallotService {

    private static final String MENTIONS = Arrays.stream(Mention.values())
        .map(Mention::wireName)
        .collect(Collectors.joining(", "));

    private final PollService polls;
    private final ApprovalBallotService approvals;
    private final JudgmentBallotService judgments;

    public BallotService(PollService polls, ApprovalBallotService approvals, JudgmentBallotService judgments) {
        this.polls = polls;
        this.approvals = approvals;
        this.judgments = judgments;
    }

    /** Returns the poll the ballot was cast on. */
    @Transactional
    public Poll cast(String shareToken, CastBallotRequest ballot, String voterId) {
        var poll = polls.findOpen(shareToken);
        var optionIds = polls.optionsOf(poll).stream().map(PollOption::id).toList();

        switch (poll.votingSystem()) {
            case APPROVAL -> approvals.cast(poll.id(), voterId, approvedOptions(ballot, optionIds));
            case MAJORITY_JUDGMENT -> judgments.cast(poll.id(), voterId, mentions(ballot, optionIds), optionIds);
        }
        return poll;
    }

    private static Set<Long> approvedOptions(CastBallotRequest ballot, List<Long> optionIds) {
        if (ballot.approvedOptionIds() == null || ballot.judgments() != null) {
            throw new InvalidRequestException(
                "This is an approval poll: send the approved options as \"approvedOptionIds\".");
        }
        var approved = new HashSet<Long>();
        for (var optionId : ballot.approvedOptionIds()) {
            approved.add(optionOf(optionId, optionIds));
        }
        return approved;
    }

    private static Map<Long, Mention> mentions(CastBallotRequest ballot, List<Long> optionIds) {
        if (ballot.judgments() == null || ballot.approvedOptionIds() != null) {
            throw new InvalidRequestException(
                "This is a majority judgment poll: send one mention per option as \"judgments\".");
        }
        var mentions = new HashMap<Long, Mention>();
        ballot.judgments().forEach((optionId, mention) -> mentions.put(
            optionOf(optionId, optionIds),
            Mention.fromWireName(mention).orElseThrow(() -> new InvalidRequestException(
                "\"" + mention + "\" is not a mention. Use one of: " + MENTIONS + "."))));
        return mentions;
    }

    private static Long optionOf(String optionId, List<Long> optionIds) {
        try {
            var id = Long.valueOf(optionId);
            if (optionIds.contains(id)) {
                return id;
            }
        } catch (NumberFormatException notANumber) {
            // Reported below, like any other id that is not an option of this poll.
        }
        throw new InvalidRequestException("\"" + optionId + "\" is not an option of this poll.");
    }
}
