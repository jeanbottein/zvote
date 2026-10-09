package org.zvote.server.api.dto;

import java.util.List;
import java.util.Map;

/**
 * A whole ballot, replacing any previous one. Approval polls take
 * approvedOptionIds; majority judgment polls take judgments (option id to
 * mention). An empty ballot withdraws.
 *
 * voterName is part of the ballot, on polls that show names: left out or
 * blank, the voter takes part anonymously.
 */
public record CastBallotRequest(
    List<String> approvedOptionIds,
    Map<String, String> judgments,
    String voterName
) {}
