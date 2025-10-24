package org.zvote.server.votemanagement;

import lombok.Builder;
import lombok.With;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("votes")
@Builder
@With
public record Vote(
    @Id Long id,
    UUID publicId,  // External identifier
    String creatorId,  // User identity
    String title,
    Visibility visibility,
    VotingSystem votingSystem,
    boolean limitByIp,
    String shareToken,
    Instant createdAt
) {
    
    public enum Visibility {
        PUBLIC,
        UNLISTED,
        PRIVATE
    }
    
    public enum VotingSystem {
        APPROVAL,
        MAJORITY_JUDGMENT
    }
}
