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
public record ZVoteProperties(Features features, Limits limits, String publicUrl) {

    /**
     * publicUrl: where people reach this server's polls, without a trailing
     * slash - what a share link and an invitation link are built from, for a
     * client that does not know its own address (an agent) or runs on another
     * one (a packaged app). Left out, those links are left to the client.
     */
    public ZVoteProperties {
        publicUrl = publicUrl == null || publicUrl.isBlank() ? null : publicUrl.strip();
        if (publicUrl != null) {
            if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
                throw new IllegalArgumentException("zvote.public-url must start with http:// or https://");
            }
            while (publicUrl.endsWith("/")) {
                publicUrl = publicUrl.substring(0, publicUrl.length() - 1);
            }
        }
    }

    public record Features(
        boolean publicPolls,
        boolean unlistedPolls,
        boolean approvalVoting,
        boolean majorityJudgment
    ) {}

    /**
     * maxVoterNameLength holds for the names on invitations too.
     * maxInvitations: per poll; any number costs the same (see
     * polls.InvitationService). pollLifetimeDays: a poll is deleted, with its
     * ballots, this many days after it was created. A limit left out binds to
     * 0, which for the lifetime would delete every poll at the next retention
     * run: the server refuses to start instead. Texts must fit their columns
     * (V1__init.sql).
     */
    public record Limits(
        int maxOptions,
        int maxTitleLength,
        int maxOptionLength,
        int maxVoterNameLength,
        long maxInvitations,
        int pollLifetimeDays
    ) {
        public Limits {
            require(maxOptions >= 2, "zvote.limits.max-options must be at least 2");
            require(maxTitleLength >= 1 && maxTitleLength <= 500, "zvote.limits.max-title-length must be 1 to 500");
            require(maxOptionLength >= 1 && maxOptionLength <= 500, "zvote.limits.max-option-length must be 1 to 500");
            require(maxVoterNameLength >= 1 && maxVoterNameLength <= 100,
                "zvote.limits.max-voter-name-length must be 1 to 100");
            require(maxInvitations >= 1, "zvote.limits.max-invitations must be at least 1");
            require(pollLifetimeDays >= 1, "zvote.limits.poll-lifetime-days must be at least 1");
        }

        private static void require(boolean valid, String problem) {
            if (!valid) {
                throw new IllegalArgumentException(problem);
            }
        }
    }
}
