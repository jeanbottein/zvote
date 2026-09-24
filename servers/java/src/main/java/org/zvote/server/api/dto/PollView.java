package org.zvote.server.api.dto;

import org.zvote.server.polls.Poll;

import java.time.Instant;
import java.util.List;

/**
 * A poll as one particular voter sees it: its results, whether they created
 * it, and their own ballot (null until they vote).
 *
 * The id is the share token - the only identifier that leaves the server.
 */
public record PollView(
    String id,
    String title,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    Instant createdAt,
    Instant closedAt,
    boolean isMine,
    long totalBallots,
    List<OptionView> options,
    MyBallotView myBallot
) {}
