package org.zvote.server.api;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.ballots.approval.ApprovalBallotService;
import org.zvote.server.ballots.judgment.JudgmentBallotService;
import org.zvote.server.ballots.judgment.Mention;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.live.PollStream;
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
 * Casting a ballot is a PUT: a voter has at most one ballot per poll, and
 * sending another replaces it. Revising and withdrawing are therefore the same
 * operation, and retries are harmless.
 */
@RestController
@RequestMapping("/api/polls/{id}/ballot")
public class BallotController {

    private static final String MENTIONS = Arrays.stream(Mention.values())
        .map(Mention::wireName)
        .collect(Collectors.joining(", "));

    private final PollService polls;
    private final ApprovalBallotService approvals;
    private final JudgmentBallotService judgments;
    private final PollViewService views;
    private final PollStream stream;

    public BallotController(PollService polls, ApprovalBallotService approvals, JudgmentBallotService judgments,
                            PollViewService views, PollStream stream) {
        this.polls = polls;
        this.approvals = approvals;
        this.judgments = judgments;
        this.views = views;
        this.stream = stream;
    }

    @PutMapping
    public PollView cast(@PathVariable String id,
                         @RequestBody CastBallotRequest ballot,
                         @RequestAttribute(VoterIdentity.ATTRIBUTE) String voterId) {
        var poll = polls.findOpen(id);
        var optionIds = polls.optionsOf(poll).stream().map(PollOption::id).toList();

        switch (poll.votingSystem()) {
            case APPROVAL -> approvals.cast(poll.id(), voterId, approvedOptions(ballot, optionIds));
            case MAJORITY_JUDGMENT -> judgments.cast(poll.id(), voterId, mentions(ballot, optionIds), optionIds);
        }

        stream.changed(poll.id(), () -> views.update(poll.id()));
        return views.view(poll, voterId);
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
