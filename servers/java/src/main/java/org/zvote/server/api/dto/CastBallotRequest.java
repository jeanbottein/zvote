package org.zvote.server.api.dto;

import java.util.List;
import java.util.Map;

/**
 * A whole ballot, replacing any previous one. Approval polls take
 * approvedOptionIds; majority judgment polls take judgments (option id to
 * mention). An empty ballot withdraws.
 */
public record CastBallotRequest(
    List<String> approvedOptionIds,
    Map<String, String> judgments
) {}
