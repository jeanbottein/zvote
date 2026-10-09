package org.zvote.server.api.mcp;

import org.zvote.server.api.dto.PollUpdate;

import java.util.List;

/**
 * A poll's results with its winner named: the options placed at rank 1, which
 * is several of them when they are ex aequo, and none while the poll keeps its
 * results back.
 *
 * The counts come with it, so the ranking can be checked rather than believed.
 */
public record Decision(List<String> winner, PollUpdate results) {}
