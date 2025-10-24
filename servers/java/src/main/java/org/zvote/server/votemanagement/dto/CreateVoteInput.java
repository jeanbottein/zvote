package org.zvote.server.votemanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import org.zvote.server.votemanagement.Vote;

import java.util.List;

@Builder
public record CreateVoteInput(
    @NotBlank(message = "Title is required")
    @Size(min = 1, max = 200, message = "Title must be between 1 and 200 characters")
    String title,
    
    @NotNull(message = "Options are required")
    @Size(min = 2, max = 20, message = "Must have between 2 and 20 options")
    List<@NotBlank String> options,
    
    Vote.Visibility visibility,
    Vote.VotingSystem votingSystem,
    boolean limitByIp
) {}
