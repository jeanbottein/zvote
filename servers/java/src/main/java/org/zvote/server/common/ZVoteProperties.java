package org.zvote.server.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * What this server instance offers, from the {@code zvote} section of
 * application.yml.
 *
 * Clients read it at GET /api/server-info to adapt their UI, and PollService
 * enforces it, so the advertisement can never promise more than the server does.
 */
@ConfigurationProperties(prefix = "zvote")
public record ZVoteProperties(Features features, Limits limits) {

    public record Features(
        boolean publicPolls,
        boolean unlistedPolls,
        boolean approvalVoting,
        boolean majorityJudgment
    ) {}

    /**
     * pollLifetimeDays: a poll is deleted, with its ballots, this many days
     * after it was created. A limit left out binds to 0, which for the
     * lifetime would delete every poll at the next retention run: the server
     * refuses to start instead. Texts must fit their columns (V1, V2).
     */
    public record Limits(
        int maxOptions,
        int maxTitleLength,
        int maxOptionLength,
        int maxVoterNameLength,
        int pollLifetimeDays
    ) {
        public Limits {
            require(maxOptions >= 2, "zvote.limits.max-options must be at least 2");
            require(maxTitleLength >= 1 && maxTitleLength <= 500, "zvote.limits.max-title-length must be 1 to 500");
            require(maxOptionLength >= 1 && maxOptionLength <= 500, "zvote.limits.max-option-length must be 1 to 500");
            require(maxVoterNameLength >= 1 && maxVoterNameLength <= 100,
                "zvote.limits.max-voter-name-length must be 1 to 100");
            require(pollLifetimeDays >= 1, "zvote.limits.poll-lifetime-days must be at least 1");
        }

        private static void require(boolean valid, String problem) {
            if (!valid) {
                throw new IllegalArgumentException(problem);
            }
        }
    }
}
