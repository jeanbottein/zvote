package org.zvote.server.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

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
 * A client that is not a browser - an agent, a script, a packaged app - asks
 * for a token of its own (POST /api/voters) and sends it as a bearer token
 * instead of a cookie. It is the same credential either way.
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

    /** 256 random bits, base64url: exactly what {@link #newToken()} issues. */
    public static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");

    private static final SecureRandom RANDOM = new SecureRandom();

    private VoterIdentity() {}

    /**
     * A voter nobody has been before: 256 random bits. Minting one is free and
     * tells nothing of any other voter, which is why POST /api/voters can hand
     * one to whoever asks.
     */
    public static String newToken() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return base64url(bytes);
    }

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
