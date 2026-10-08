package org.zvote.server.identity;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

/**
 * The holder of a voter token, and the keys their records are stored under.
 *
 * Ballots and names are keyed per poll, with an HMAC of the token under the
 * server's voter secret: the server recomputes a key for whoever holds the
 * token, so voters can revise their ballot, but nothing stored leads back to
 * them. Without the token, a copy of the database cannot tell whose ballot a
 * row is, cannot link one voter's ballots across polls, and cannot link a
 * creator to their own ballot. Ballots and names use different keys, so that
 * a name never joins with what its voter chose.
 */
public final class Voter {

    private static final String HMAC = "HmacSHA256";

    private final String token;
    private final SecretKey secret;
    private final String id;

    Voter(String token, SecretKey secret) {
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

    private String key(String purpose, long pollId) {
        try {
            var mac = Mac.getInstance(HMAC);
            mac.init(secret);
            var message = (purpose + ":" + pollId + ":" + token).getBytes(StandardCharsets.US_ASCII);
            return VoterIdentity.base64url(mac.doFinal(message));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Every JVM ships " + HMAC, e);
        }
    }
}
