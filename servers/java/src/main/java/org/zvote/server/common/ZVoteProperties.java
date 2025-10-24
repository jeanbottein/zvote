package org.zvote.server.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "zvote")
public record ZVoteProperties(
    Features features,
    Limits limits
) {
    public record Features(
        boolean publicVotes,
        boolean unlistedVotes,
        boolean privateVotes,
        boolean approvalVoting,
        boolean majorityJudgment,
        boolean ipLimiting,
        boolean liveBallot,
        boolean envelopeBallot
    ) {}
    
    public record Limits(
        int maxOptions
    ) {}
}
