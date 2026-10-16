package org.supervote.server.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * What one network may do in a day, from the {@code super-vote.rate-limits}
 * section of application.yml. A limit left out binds to 0, which would refuse
 * everything: the server refuses to start instead.
 *
 * @param pollsPerDay      polls a network may create in a day, its first poll starting the day
 * @param wrongCodesInARow join codes leading to no poll, one after the other, before codes are refused for a day
 * @param wrongCodesPerDay the same, right ones in between or not
 */
@ConfigurationProperties(prefix = "super-vote.rate-limits")
public record RateLimits(int pollsPerDay, int wrongCodesInARow, int wrongCodesPerDay) {

    public RateLimits {
        require(pollsPerDay >= 1, "super-vote.rate-limits.polls-per-day must be at least 1");
        require(wrongCodesInARow >= 1, "super-vote.rate-limits.wrong-codes-in-a-row must be at least 1");
        require(wrongCodesPerDay >= 1, "super-vote.rate-limits.wrong-codes-per-day must be at least 1");
    }

    private static void require(boolean valid, String problem) {
        if (!valid) {
            throw new IllegalArgumentException(problem);
        }
    }
}
