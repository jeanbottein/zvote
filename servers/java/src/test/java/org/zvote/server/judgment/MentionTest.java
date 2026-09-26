package org.zvote.server.judgment;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class MentionTest {

    @Test
    void theScaleRunsFromWorstToBestUnderItsWireNames() {
        assertThat(Arrays.stream(Mention.values()).map(Mention::wireName))
            .containsExactly("Bad", "Inadequate", "Passable", "Fair", "Good", "VeryGood", "Excellent");
    }

    @Test
    void readsOnlyExactWireNames() {
        assertThat(Mention.fromWireName("VeryGood")).contains(Mention.VERY_GOOD);
        assertThat(Mention.fromWireName("VERY_GOOD")).isEmpty();
        assertThat(Mention.fromWireName("verygood")).isEmpty();
        assertThat(Mention.fromWireName(null)).isEmpty();
    }
}
