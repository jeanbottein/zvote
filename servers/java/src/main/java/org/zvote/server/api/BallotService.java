package org.zvote.server.api;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.ballots.BallotBoxService;
import org.zvote.server.ballots.Mention;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.identity.Voter;
import org.zvote.server.polls.InvitationService;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollOption;
import org.zvote.server.polls.PollService;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Casts a ballot in the poll's voting system, after checking the voter may
 * (InvitationService), and that it has the right shape and only this poll's
 * options, and writes it as {@link BallotFormat} says.
 *
 * One transaction holds the poll's lock from the check that it is open to the
 * saved ballot, so a poll closed or deleted at the same moment either waits
 * for the ballot or refuses it: a ballot is never counted after closing, nor
 * reported counted on a poll being deleted.
 */
@Service
public class BallotService {

    private static final byte[] WITHDRAWN = {};

    private static final String MENTIONS = Arrays.stream(Mention.values())
        .map(Mention::wireName)
        .collect(Collectors.joining(", "));

    private final PollService polls;
    private final InvitationService invitations;
    private final BallotBoxService ballotBox;

    public BallotService(PollService polls, InvitationService invitations, BallotBoxService ballotBox) {
        this.polls = polls;
        this.invitations = invitations;
        this.ballotBox = ballotBox;
    }

    /**
     * Returns the poll the ballot was cast on. The voter's name goes with their
     * ballot, but under a key of its own (see {@link Voter}). invitation: the
     * token from the invitation link the voter came with, if any.
     */
    @Transactional
    public Poll cast(String shareToken, CastBallotRequest ballot, Voter voter, String invitation) {
        var poll = polls.findOpen(shareToken);
        invitations.admit(poll, voter.id(), voter.invitationKey(poll.id()), invitation);
        var options = polls.optionsOf(poll);
        var choices = switch (poll.votingSystem()) {
            case APPROVAL -> approvals(ballot, options);
            case MAJORITY_JUDGMENT -> judgments(ballot, options);
        };
        ballotBox.cast(poll.id(), voter.ballotKey(poll.id()), choices);
        polls.nameVoter(poll, voter.nameKey(poll.id()), choices.length == 0 ? null : ballot.voterName());
        return poll;
    }

    /** Approving nothing withdraws. */
    private static byte[] approvals(CastBallotRequest ballot, List<PollOption> options) {
        if (ballot.approvedOptionIds() == null || ballot.judgments() != null) {
            throw new InvalidRequestException(
                "This is an approval poll: send the approved options as \"approvedOptionIds\".");
        }
        var approved = new HashSet<Long>();
        for (var optionId : ballot.approvedOptionIds()) {
            approved.add(optionOf(optionId, options));
        }
        return approved.isEmpty() ? WITHDRAWN : BallotFormat.encodeApprovals(approved, options);
    }

    /** An empty ballot withdraws. */
    private static byte[] judgments(CastBallotRequest ballot, List<PollOption> options) {
        if (ballot.judgments() == null || ballot.approvedOptionIds() != null) {
            throw new InvalidRequestException(
                "This is a majority judgment poll: send one mention per option as \"judgments\".");
        }
        var mentions = new HashMap<Long, Mention>();
        ballot.judgments().forEach((optionId, mention) -> mentions.put(
            optionOf(optionId, options),
            Mention.fromWireName(mention).orElseThrow(() -> new InvalidRequestException(
                "\"" + mention + "\" is not a mention. Use one of: " + MENTIONS + "."))));
        return mentions.isEmpty() ? WITHDRAWN : BallotFormat.encodeJudgments(mentions, options);
    }

    private static Long optionOf(String optionId, List<PollOption> options) {
        try {
            var id = Long.valueOf(optionId);
            if (options.stream().anyMatch(option -> option.id().equals(id))) {
                return id;
            }
        } catch (NumberFormatException notANumber) {
            // Reported below, like any other id that is not an option of this poll.
        }
        throw new InvalidRequestException("\"" + optionId + "\" is not an option of this poll.");
    }
}
