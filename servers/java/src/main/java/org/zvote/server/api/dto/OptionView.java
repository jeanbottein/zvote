package org.zvote.server.api.dto;

import java.util.Map;

/**
 * One option and its tallies. Approval polls fill approvalCount; majority
 * judgment polls fill judgmentCounts with the seven mention tallies, worst
 * first, under their wire names (Bad ... Excellent). The client ranks the
 * options itself from these numbers.
 */
public record OptionView(
    String id,
    String label,
    Long approvalCount,
    Map<String, Long> judgmentCounts
) {}
