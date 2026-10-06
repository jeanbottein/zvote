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

    /** pollLifetimeDays: a poll is deleted, with its ballots, this many days after it was created. */
    public record Limits(
        int maxOptions,
        int maxTitleLength,
        int maxOptionLength,
        int maxVoterNameLength,
        int pollLifetimeDays
    ) {}
}
