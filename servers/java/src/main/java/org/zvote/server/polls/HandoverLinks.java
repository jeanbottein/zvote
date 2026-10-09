package org.zvote.server.polls;

import org.springframework.stereotype.Component;
import org.zvote.server.common.VoterSecret;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

/**
 * The token that hands a poll over to whoever brings it: the server's
 * signature of the poll, under its secret.
 *
 * Signed rather than stored, as invitation links are (InvitationLinks), so the
 * database holds no credential - not even a hash of one - and the token can be
 * answered again to a client retrying the request that created the poll. What
 * is stored is only whether the handover is still open: using it closes it,
 * and a link that leaked afterwards opens nothing.
 */
@Component
record HandoverLinks(VoterSecret secret) {

    private static final int SIGNATURE_BYTES = 16;

    String tokenOf(long pollId) {
        var signature = Arrays.copyOf(secret.sign("handover:" + pollId), SIGNATURE_BYTES);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
    }

    boolean isFor(long pollId, String token) {
        return token != null && MessageDigest.isEqual(
            tokenOf(pollId).getBytes(StandardCharsets.US_ASCII), token.getBytes(StandardCharsets.US_ASCII));
    }
}
