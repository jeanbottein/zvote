package org.zvote.server.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

class VoterSecretTest {

    @Test
    void aServerWithoutARealSecretDoesNotStart() {
        assertThatIllegalStateException().isThrownBy(() -> new VoterSecret(""))
            .withMessageContaining("ZVOTE_VOTER_SECRET");
        assertThatIllegalStateException().isThrownBy(() -> new VoterSecret("x".repeat(31)));
    }

    @Test
    void signsTheSameMessageTheSameWayUnderTheSameSecretOnly() {
        var secret = new VoterSecret("a".repeat(32));

        assertThat(secret.sign("ballot:1")).isEqualTo(secret.sign("ballot:1"))
            .isNotEqualTo(secret.sign("ballot:2"))
            .isNotEqualTo(new VoterSecret("b".repeat(32)).sign("ballot:1"));
    }
}
