package org.zvote.server.api.dto;

import java.util.Map;

/**
 * One option, its tallies and its place in the results.
 *
 * Approval polls fill approvalCount; majority judgment polls fill
 * judgmentCounts with the seven mention tallies, worst first, under their wire
 * names (Bad ... Excellent), and majorityMention and score with what ranks
 * them (see api.Ranking). rank is 1 for the winner, and a rank shared by
 * several options means they are ex aequo.
 *
 * Options come in the poll's own order, never sorted: that order is what a
 * ballot's bytes are positions in. Read rank to order them.
 *
 * All of these are null while the poll keeps its results back (see
 * Poll.ResultsShown) - a ranking would say who is winning just as the tallies
 * would. Only the number of ballots shows then.
 */
public record OptionView(
    String id,
    String label,
    Long approvalCount,
    Map<String, Long> judgmentCounts,
    Integer rank,
    String majorityMention,
    Score score
) {}
