package org.supervote.server.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class PollQuotaTest {

    final PollQuota quota = new PollQuota(new RateLimits(3, 5, 20));
    final Network office = Network.of("203.0.113.7");
    final Network home = Network.of("198.51.100.4");

    @Test
    void aNetworkIsToldWhatItHasLeft() {
        quota.take(office);

        var allowance = quota.allowance(office);

        assertThat(allowance.limit()).isEqualTo(3);
        assertThat(allowance.remaining()).isEqualTo(2);
        assertThat(allowance.window()).isEqualTo(Duration.ofDays(1));
        assertThat(allowance.resetsIn()).isBetween(Duration.ofHours(23), Duration.ofDays(1));
    }

    @Test
    void aNetworkThatCreatedItsShareWaitsForItsDayToEnd() {
        quota.take(office);
        quota.take(office);
        quota.take(office);

        assertThatExceptionOfType(TooManyPollsException.class)
            .isThrownBy(() -> quota.take(office))
            .satisfies(refused -> assertThat(refused.retryAfter()).isBetween(Duration.ofHours(23), Duration.ofDays(1)))
            .withMessageStartingWith("3 polls have already been created today from this connection.")
            .withMessageEndingWith("you can create more in 24 hours.");
        assertThat(quota.allowance(office).remaining()).isZero();
    }

    @Test
    void oneNetworksShareIsNotAnothers() {
        quota.take(office);
        quota.take(office);
        quota.take(office);

        quota.take(home);

        assertThat(quota.allowance(home).remaining()).isEqualTo(2);
    }
}
