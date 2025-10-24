package org.zvote.server.votemanagement;

import lombok.Builder;
import lombok.With;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("vote_options")
@Builder
@With
public record VoteOption(
    @Id Long id,
    Long voteId,
    String label,
    int orderIndex,
    int approvalsCount
) {}
