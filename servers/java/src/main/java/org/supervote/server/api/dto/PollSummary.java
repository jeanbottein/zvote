package org.supervote.server.api.dto;

import org.supervote.server.polls.Poll;

import java.time.Instant;

/** A poll in a list: enough to show and open it, without its results. */
public record PollSummary(
    String id,
    String title,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    Instant createdAt,
    Instant closedAt,
    boolean isMine
) {}
