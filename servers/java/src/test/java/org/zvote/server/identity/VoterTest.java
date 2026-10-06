package org.zvote.server.identity;

import org.junit.jupiter.api.Test;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class VoterTest {

    static final String TOKEN = "a".repeat(43);

    @Test
    void theSameVoterFindsTheirKeysAgain() {
        assertThat(voter(TOKEN, "secret").ballotKey(1)).isEqualTo(voter(TOKEN, "secret").ballotKey(1));
        assertThat(voter(TOKEN, "secret").nameKey(1)).isEqualTo(voter(TOKEN, "secret").nameKey(1));
    }

    @Test
    void everyKeyIsItsOwn() {
        var voter = voter(TOKEN, "secret");

        assertThat(voter.ballotKey(1))
            .isNotEqualTo(voter.ballotKey(2))
            .isNotEqualTo(voter.nameKey(1))
            .isNotEqualTo(voter.id())
            .isNotEqualTo(voter(TOKEN, "another secret").ballotKey(1))
            .isNotEqualTo(voter("b".repeat(43), "secret").ballotKey(1));
    }

    @Test
    void theIdIsTheSameWhateverTheSecret() {
        assertThat(voter(TOKEN, "secret").id()).isEqualTo(voter(TOKEN, "another secret").id());
    }

    static Voter voter(String token, String secret) {
        return new Voter(token, new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    }
}
