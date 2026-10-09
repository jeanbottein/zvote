package org.zvote.server.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.CreateInvitationsRequest;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.polls.InvitationPage;
import org.zvote.server.polls.InvitationService;

/**
 * The invitations to a poll that only invited people may vote on, which its
 * creator makes and sends (see InvitationService), newest first, a page at a
 * time.
 *
 * A voter brings theirs in the Zvote-Invitation header, to read the poll and
 * to cast a ballot, never in a URL: the web client keeps it in the page
 * address's fragment (#invitation=...), which browsers do not send, so that
 * no server or proxy log ever holds it.
 */
@RestController
@RequestMapping("/api/polls/{id}/invitations")
public class InvitationController {

    static final String HEADER = "Zvote-Invitation";

    private final InvitationService invitations;

    InvitationController(InvitationService invitations) {
        this.invitations = invitations;
    }

    @GetMapping
    public InvitationPage list(@PathVariable String id,
                               @RequestParam(required = false) Long before,
                               @RequestParam(required = false) Integer limit,
                               @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return invitations.invitationsOf(id, voter.id(), before, limit);
    }

    /** Answers the newest invitations, the new ones first. */
    @PostMapping
    public ResponseEntity<InvitationPage> invite(@PathVariable String id,
                                                 @RequestBody CreateInvitationsRequest request,
                                                 @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        invitations.invite(id, voter.id(), request.label(), request.count() == null ? 1 : request.count());
        return ResponseEntity.status(HttpStatus.CREATED).body(invitations.invitationsOf(id, voter.id(), null, null));
    }

    @DeleteMapping("/{number}")
    public ResponseEntity<Void> revoke(@PathVariable String id,
                                       @PathVariable long number,
                                       @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        invitations.revoke(id, voter.id(), number);
        return ResponseEntity.noContent().build();
    }
}
