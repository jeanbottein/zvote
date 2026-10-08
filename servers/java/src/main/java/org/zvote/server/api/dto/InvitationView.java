package org.zvote.server.api.dto;

import org.zvote.server.polls.Invitation;

/**
 * An invitation as its poll's creator sees it: the token its link carries,
 * whom it is for (null if they did not say), and whether a ballot was cast
 * with it. Never which ballot.
 */
public record InvitationView(String token, String label, boolean used) {

    public static InvitationView of(Invitation invitation) {
        return new InvitationView(invitation.token(), invitation.label(), invitation.isUsed());
    }
}
