package org.zvote.server.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.CreateInvitationRequest;
import org.zvote.server.api.dto.InvitationView;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.polls.InvitationService;

import java.net.URI;
import java.util.List;

/**
 * The invitations to a poll that only invited people may vote on, which its
 * creator makes and sends (see InvitationService).
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
    public List<InvitationView> list(@PathVariable String id,
                                     @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return invitations.invitationsOf(id, voter.id()).stream().map(InvitationView::of).toList();
    }

    @PostMapping
    public ResponseEntity<InvitationView> invite(@PathVariable String id,
                                                 @RequestBody CreateInvitationRequest request,
                                                 @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        var invitation = invitations.invite(id, voter.id(), request.label());
        return ResponseEntity.created(URI.create("/api/polls/" + id + "/invitations/" + invitation.token()))
            .body(InvitationView.of(invitation));
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> revoke(@PathVariable String id,
                                       @PathVariable String token,
                                       @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        invitations.revoke(id, voter.id(), token);
        return ResponseEntity.noContent().build();
    }
}
