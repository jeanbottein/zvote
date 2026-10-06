package org.zvote.server.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Everything about a poll that can change, pushed live to its watchers.
 *
 * It is the same for every watcher, so a client merges it straight into its
 * PollView and keeps its own isMine and myBallot. voterNames is null unless
 * the poll shows names: then it holds the names voters chose to give, which
 * say who took part, never what they chose.
 */
public record PollUpdate(
    Instant closedAt,
    long totalBallots,
    List<OptionView> options,
    List<String> voterNames
) {}
