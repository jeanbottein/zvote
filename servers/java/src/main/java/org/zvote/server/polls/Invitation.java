package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

/**
 * One voter's way into a poll that only invited people may vote on (see
 * {@link InvitationService}). The token is the secret in its link; the label
 * says whom the creator made it for, and only they see it. Once a ballot is
 * cast with it, usedBy holds the invitation key of the browser that cast it,
 * which matches neither that ballot's key nor its voter's name's.
 */
public record Invitation(
    @Id Long id,
    Long pollId,
    String token,
    String label,
    String usedBy
) {
    public boolean isUsed() {
        return usedBy != null;
    }
}
