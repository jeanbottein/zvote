package org.zvote.server.votemanagement.dto;

import lombok.Builder;
import org.zvote.server.votemanagement.Vote;

@Builder
public record CreateVoteResult(
    Vote vote,
    String error
) {}
