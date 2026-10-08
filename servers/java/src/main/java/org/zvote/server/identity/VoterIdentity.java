package org.zvote.server.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Who is voting.
 *
 * Identity is anonymous-first: a friend who opens a share link must be able to
 * vote without creating an account. So every browser gets a random voter token
 * on first contact, held in an HttpOnly cookie that scripts on the page can
 * never read.
 *
 * The token is a credential, and like a password it is never stored. The voter
 * id - what a poll's creator is stored as - is a hash of it, so a copy of the
 * database is not enough to impersonate anyone. Ballots and names are stored
 * under other keys, one per poll (see {@link Voter}).
 *
 * Signing in with an account (see docs/ROADMAP.md) will resolve to a voter id
 * in this same place, and must carry the anonymous token over to the account
 * so that ballots cast before signing in keep their owner.
 */
public final class VoterIdentity {

    /** Request attribute holding the caller, a {@link Voter}. Set for every /api request. */
    public static final String ATTRIBUTE = "zvote.voterId";

    /** Cookie carrying the voter token. */
    public static final String COOKIE = "zvote_voter";

    private VoterIdentity() {}

    /** The voter id a token stands for: base64url(SHA-256(token)). */
    public static String voterIdOf(String token) {
        try {
            return base64url(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Every JVM ships SHA-256", e);
        }
    }

    static String base64url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
