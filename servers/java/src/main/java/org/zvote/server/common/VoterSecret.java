package org.zvote.server.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

/**
 * The server's secret, ZVOTE_VOTER_SECRET, and the signatures made with it:
 * the keys a voter's records are stored under (identity.Voter), and the links
 * a voter is invited with (polls.InvitationLinks). Each use puts its purpose
 * first in what it signs, so that no two can ever produce the same signature.
 *
 * Changing it orphans every ballot (still counted, but its voter is told they
 * have not voted, and voting again counts them twice) and voids every
 * invitation link. It never has a default, so a server cannot run on a secret
 * everybody knows.
 */
@Component
public class VoterSecret {

    private static final String HMAC = "HmacSHA256";
    private static final int MIN_LENGTH = 32;

    private final SecretKey key;

    public VoterSecret(@Value("${zvote.voter-secret:}") String secret) {
        if (secret.length() < MIN_LENGTH) {
            throw new IllegalStateException("Set ZVOTE_VOTER_SECRET to at least " + MIN_LENGTH
                + " random characters (openssl rand -base64 48): it keys who owns each ballot.");
        }
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC);
    }

    /** HMAC-SHA256 of the message under the secret. */
    public byte[] sign(String message) {
        try {
            var mac = Mac.getInstance(HMAC);
            mac.init(key);
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Every JVM ships " + HMAC, e);
        }
    }
}
