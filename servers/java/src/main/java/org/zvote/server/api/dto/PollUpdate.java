package org.zvote.server.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Everything about a poll that can change, pushed live to its watchers.
 *
 * It holds nothing specific to one voter, so a client merges it straight into
 * its PollView and keeps its own isMine and myBallot.
 */
public record PollUpdate(
    Instant closedAt,
    long totalBallots,
    List<OptionView> options
) {}
