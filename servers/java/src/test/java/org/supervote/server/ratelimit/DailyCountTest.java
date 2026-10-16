package org.supervote.server.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class DailyCountTest {

    final Instant morning = Instant.parse("2026-10-16T08:00:00Z");

    @Test
    void aDayRunsFromItsFirstCount() {
        var count = DailyCount.startingAt(morning).plusOne().plusOne();

        assertThat(count.asOf(morning.plus(Duration.ofHours(23))).count()).isEqualTo(2);
        assertThat(count.ends()).isEqualTo(Instant.parse("2026-10-17T08:00:00Z"));
    }

    @Test
    void aNewDayStartsAfresh() {
        var count = DailyCount.startingAt(morning).plusOne();
        var nextDay = morning.plus(Duration.ofDays(1));

        assertThat(count.asOf(nextDay)).isEqualTo(DailyCount.startingAt(nextDay));
    }
}
