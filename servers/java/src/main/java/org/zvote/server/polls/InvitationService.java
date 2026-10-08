package org.zvote.server.polls;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.common.ZVoteProperties;

import java.util.List;
import java.util.Optional;

/**
 * Who may vote on a poll. Anyone holding its link, unless its creator chose
 * invitations: then they make one per voter and send each link to its
 * person themselves.
 *
 * The first ballot cast with a link marks its invitation used by that
 * browser (its invitation key, see identity.Voter), which from then on votes
 * on the poll without the link, and is the only one that can. So the
 * creator, who holds every link, can open one, but can neither read nor
 * change the ballot cast with it: they learn which invitations were used,
 * never what anyone chose. They vote without an invitation.
 */
@Service
public class InvitationService {

    private final PollService polls;
    private final InvitationRepository invitations;
    private final ZVoteProperties settings;

    public InvitationService(PollService polls, InvitationRepository invitations, ZVoteProperties settings) {
        this.polls = polls;
        this.invitations = invitations;
        this.settings = settings;
    }

    /** The poll's invitations, in the order they were made. Its creator only. */
    public List<Invitation> invitationsOf(String shareToken, String voterId) {
        return invitations.findByPollIdOrderById(polls.createdBy(shareToken, voterId).id());
    }

    /** A new invitation; the label, if any, says whom it is for. Its creator only, while the poll is open. */
    @Transactional
    public Invitation invite(String shareToken, String voterId, String label) {
        var poll = polls.createdBy(shareToken, voterId);
        if (!poll.invitationOnly()) {
            throw new InvalidRequestException("Anyone with the link can vote on this poll: it takes no invitations.");
        }
        if (poll.isClosed()) {
            throw new PollClosedException("This poll is closed: nobody else can vote on it.");
        }
        var max = settings.limits().maxInvitations();
        if (invitations.countByPollId(poll.id()) >= max) {
            throw new InvalidRequestException("A poll can have at most " + max + " invitations.");
        }
        var name = polls.validName(label);
        return invitations.save(
            new Invitation(null, poll.id(), PollService.randomToken(), name.isEmpty() ? null : name, null));
    }

    /** Takes back an invitation nobody has voted with: its link stops working. Its creator only. */
    @Transactional
    public void revoke(String shareToken, String voterId, String token) {
        var poll = polls.createdBy(shareToken, voterId);
        if (!invitations.deleteUnused(poll.id(), token) && invitations.existsByPollIdAndToken(poll.id(), token)) {
            throw new InvitationUsedException(
                "Someone has voted with this invitation, so it can no longer be taken back.");
        }
    }

    /** Whether this voter may vote, with the invitation they bring (the token from its link, or null). */
    public Admission admissionOf(Poll poll, String voterId, String invitationKey, String token) {
        if (admitted(poll, voterId, invitationKey)) {
            return Admission.ADMITTED;
        }
        return invitation(poll, token)
            .map(invitation -> invitation.isUsed() ? Admission.INVITATION_USED : Admission.ADMITTED)
            .orElse(Admission.NOT_INVITED);
    }

    /**
     * Lets this voter cast a ballot, or says why not. Voting with an unused
     * invitation marks it used by them, in the caller's transaction: of two
     * browsers voting with one link at the same moment, one is refused.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void admit(Poll poll, String voterId, String invitationKey, String token) {
        if (admitted(poll, voterId, invitationKey)) {
            return;
        }
        var invitation = invitation(poll, token).orElseThrow(() -> new NotInvitedException(token == null
            ? "Only invited people can vote on this poll. If you were invited, open the link from your invitation."
            : "This invitation link is not valid. Ask whoever invited you for a new one."));
        if (!invitations.use(invitation.id(), invitationKey)) {
            throw new InvitationUsedException(
                "This invitation was already used, in another browser or on another device. Its ballot can only be changed there.");
        }
    }

    private boolean admitted(Poll poll, String voterId, String invitationKey) {
        return !poll.invitationOnly()
            || poll.isCreatedBy(voterId)
            || invitations.existsByPollIdAndUsedBy(poll.id(), invitationKey);
    }

    private Optional<Invitation> invitation(Poll poll, String token) {
        return token == null ? Optional.empty() : invitations.findByPollIdAndToken(poll.id(), token);
    }
}
