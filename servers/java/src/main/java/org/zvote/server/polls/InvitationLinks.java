package org.zvote.server.polls;

import org.springframework.stereotype.Component;
import org.zvote.server.common.VoterSecret;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.OptionalLong;
import java.util.regex.Pattern;

/**
 * The token in an invitation's link: the invitation's number and the
 * server's signature of it for its poll, as in {@code 42.qWsD_0PPBuKgjv6h9yEQxA}.
 *
 * Links are signed rather than stored: the server tells one it made by
 * signing its number again. So a poll can have a billion invitations for the
 * cost of a counter, and a copy of the database holds no link anyone could
 * vote with. The signature's 128 bits are as hard to guess as a random token
 * of that size.
 */
@Component
record InvitationLinks(VoterSecret secret) {

    private static final Pattern TOKEN = Pattern.compile("([1-9][0-9]{0,18})\\.([A-Za-z0-9_-]{22})");
    private static final int SIGNATURE_BYTES = 16;

    String tokenOf(long pollId, long number) {
        return number + "." + signatureOf(pollId, number);
    }

    /** The number of the invitation behind a token (null: none), if this server made it for this poll. */
    OptionalLong numberOf(long pollId, String token) {
        var parts = token == null ? null : TOKEN.matcher(token);
        if (parts == null || !parts.matches()) {
            return OptionalLong.empty();
        }
        long number;
        try {
            number = Long.parseLong(parts.group(1));
        } catch (NumberFormatException tooLarge) {
            return OptionalLong.empty();
        }
        var expected = signatureOf(pollId, number).getBytes(StandardCharsets.US_ASCII);
        var given = parts.group(2).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, given) ? OptionalLong.of(number) : OptionalLong.empty();
    }

    private String signatureOf(long pollId, long number) {
        var signature = Arrays.copyOf(secret.sign("link:" + pollId + ":" + number), SIGNATURE_BYTES);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
    }
}
