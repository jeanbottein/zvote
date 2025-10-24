package org.zvote.server.votingsystems.approvalvoting;

import lombok.Builder;
import lombok.With;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

/**
 * Represents a user's approval ballot for a specific option.
 * This is the user's individual choice, not the overall vote result.
 */
@Table("approvals")
@Builder
@With
public record Approval(
    @Id Long id,
    Long voteId,
    Long optionId,
    String voterId,      // User identity
    Instant createdAt
) {}
