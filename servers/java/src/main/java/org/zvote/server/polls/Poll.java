package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

import java.time.Instant;

/**
 * A question being decided. One voter's answer to it is a ballot, which lives in
 * the ballots package: a poll knows nothing about how it is voted on.
 *
 * The share token is the poll's only external identifier. It appears in every
 * URL, and for an unlisted poll it is also the secret that grants access - the
 * usual "anyone with the link" trade-off. The join code is a short stand-in for
 * it, to type on a phone.
 *
 * showVoterNames and resultsShown are chosen once, at creation: whether the
 * poll shows who took part, and when its results show.
 */
public record Poll(
    @Id Long id,
    String shareToken,
    String joinCode,
    String creatorId,
    String title,
    VotingSystem votingSystem,
    Visibility visibility,
    boolean showVoterNames,
    ResultsShown resultsShown,
    /** AFTER_BALLOTS only: how many ballots must be in. */
    Integer resultsAfterBallots,
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

    /**
     * When the results show while the poll is open; once closed, they always
     * do. Tallies that move as people vote show what each of them chose:
     * AFTER_BALLOTS spares the first voters, AFTER_CLOSING everyone.
     */
    public enum ResultsShown { LIVE, AFTER_BALLOTS, AFTER_CLOSING }

    /**
     * Whether anyone, the creator included, may see the tallies now. Below
     * the threshold again (ballots withdrawn), they hide again.
     */
    public boolean showsResults(long ballots) {
        return isClosed() || switch (resultsShown) {
            case LIVE -> true;
            case AFTER_BALLOTS -> ballots >= resultsAfterBallots;
            case AFTER_CLOSING -> false;
        };
    }

    public boolean isCreatedBy(String voterId) {
        return creatorId.equals(voterId);
    }

    public boolean isClosed() {
        return closedAt != null;
    }

    Poll withClosedAt(Instant closedAt) {
        return new Poll(id, shareToken, joinCode, creatorId, title, votingSystem, visibility, showVoterNames,
            resultsShown, resultsAfterBallots, createdAt, closedAt);
    }
}
