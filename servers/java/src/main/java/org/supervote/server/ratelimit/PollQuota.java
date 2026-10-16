package org.supervote.server.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * How many polls a network may create in a day, its first poll starting the
 * day: super-vote is free, and its resources are shared fairly.
 */
@Component
public class PollQuota {

    private final RateLimits limits;
    private final RecentNetworks<DailyCount> days = new RecentNetworks<>();

    PollQuota(RateLimits limits) {
        this.limits = limits;
    }

    /** Counts a poll the network is creating, or refuses it once the network has created its share. */
    public synchronized void take(Network network) {
        var now = Instant.now();
        var today = today(network, now);
        if (today.count() >= limits.pollsPerDay()) {
            throw new TooManyPollsException(limits.pollsPerDay(), Duration.between(now, today.ends()));
        }
        days.put(network, today.plusOne());
    }

    public synchronized Allowance allowance(Network network) {
        var now = Instant.now();
        var today = today(network, now);
        return new Allowance(limits.pollsPerDay(), DailyCount.DAY, limits.pollsPerDay() - today.count(),
            Duration.between(now, today.ends()));
    }

    /** A day over is nothing to remember: no address is kept longer than its limit needs it. */
    @Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)
    synchronized void forgetPastDays() {
        var now = Instant.now();
        days.values().removeIf(day -> !now.isBefore(day.ends()));
    }

    private DailyCount today(Network network, Instant now) {
        var day = days.get(network);
        return day == null ? DailyCount.startingAt(now) : day.asOf(now);
    }
}
