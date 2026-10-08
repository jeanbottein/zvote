package org.zvote.server.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class ZVotePropertiesTest {

    @Test
    void aLifetimeLeftOutStopsTheServerRatherThanDeletingEveryPoll() {
        assertThatIllegalArgumentException()
            .isThrownBy(() -> new ZVoteProperties.Limits(20, 200, 100, 40, 0))
            .withMessageContaining("poll-lifetime-days");
    }

    @Test
    void aNameLongerThanItsColumnIsRefused() {
        assertThatIllegalArgumentException()
            .isThrownBy(() -> new ZVoteProperties.Limits(20, 200, 100, 101, 30))
            .withMessageContaining("max-voter-name-length");
    }
}
