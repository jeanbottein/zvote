package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

import java.time.Instant;

/**
 * A question being decided. One voter's answer to it is a ballot, which lives in
 * the ballots package: a poll knows nothing about how it is voted on.
 *
 * The share token is the poll's only external identifier. It appears in every
 * URL, and for an unlisted poll it is also the secret that grants access - the
 * usual "anyone with the link" trade-off.
 */
public record Poll(
    @Id Long id,
    String shareToken,
    String creatorId,
    String title,
    VotingSystem votingSystem,
    Visibility visibility,
    Instant createdAt,
    Instant closedAt
) {
    public enum VotingSystem { MAJORITY_JUDGMENT, APPROVAL }

    /**
     * Whether the poll is listed publicly. Anyone holding the link can open
     * either kind; restricting access to named people needs accounts, and
     * arrives with them.
     */
    public enum Visibility { PUBLIC, UNLISTED }

    public boolean isCreatedBy(String voterId) {
        return creatorId.equals(voterId);
    }

    public boolean isClosed() {
        return closedAt != null;
    }

    Poll withClosedAt(Instant closedAt) {
        return new Poll(id, shareToken, creatorId, title, votingSystem, visibility, createdAt, closedAt);
    }
}
