package org.zvote.server.common.dto;

import lombok.Builder;

@Builder
public record FeatureFlags(
    boolean publicVotes,
    boolean unlistedVotes,
    boolean privateVotes,
    boolean approvalVoting,
    boolean majorityJudgment,
    boolean ipLimiting,
    boolean liveBallot,
    boolean envelopeBallot
) {}
