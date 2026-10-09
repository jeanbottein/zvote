package org.zvote.server.identity;

import org.zvote.server.common.VoterSecret;

/**
 * The holder of a voter token, and the keys their records are stored under.
 *
 * Ballots and names are keyed per poll, with an HMAC of the token under the
 * server's voter secret: the server recomputes a key for whoever holds the
 * token, so voters can revise their ballot, but nothing stored leads back to
 * them. Without the token, a copy of the database cannot tell whose ballot a
 * row is, cannot link one voter's ballots across polls, and cannot link a
 * creator to their own ballot. Ballots, names and invitations use different
 * keys, so that neither a name nor an invitation joins with what its voter
 * chose.
 */
public final class Voter {

    private final String token;
    private final VoterSecret secret;
    private final String id;

    Voter(String token, VoterSecret secret) {
        this.token = token;
        this.secret = secret;
        this.id = VoterIdentity.voterIdOf(token);
    }

    /** The same on every poll: who created which poll. */
    public String id() {
        return id;
    }

    /** What this voter's ballot on one poll is stored under. */
    public String ballotKey(long pollId) {
        return key("ballot", pollId);
    }

    /** What this voter's name on one poll is stored under: never their ballot key. */
    public String nameKey(long pollId) {
        return key("name", pollId);
    }

    /** What marks the invitation this voter used on one poll: never their ballot or name key. */
    public String invitationKey(long pollId) {
        return key("invitation", pollId);
    }

    private String key(String purpose, long pollId) {
        return VoterIdentity.base64url(secret.sign(purpose + ":" + pollId + ":" + token));
    }
}
