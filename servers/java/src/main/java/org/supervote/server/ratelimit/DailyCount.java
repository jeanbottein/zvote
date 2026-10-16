package org.supervote.server.ratelimit;

import java.time.Duration;
import java.time.Instant;

/** How many times something happened to a network since its day began, with the first of them. */
record DailyCount(Instant since, int count) {

    static final Duration DAY = Duration.ofDays(1);

    static DailyCount startingAt(Instant now) {
        return new DailyCount(now, 0);
    }

    /** This count, or a new day's once this one is over. */
    DailyCount asOf(Instant now) {
        return now.isBefore(ends()) ? this : startingAt(now);
    }

    DailyCount plusOne() {
        return new DailyCount(since, count + 1);
    }

    Instant ends() {
        return since.plus(DAY);
    }
}
