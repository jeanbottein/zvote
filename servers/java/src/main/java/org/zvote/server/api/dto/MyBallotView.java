package org.zvote.server.api.dto;

import java.util.List;
import java.util.Map;

/**
 * The caller's own ballot, so the UI can show it back and let them revise it.
 * Approval polls fill approvedOptionIds; majority judgment polls fill
 * judgments (option id to mention).
 */
public record MyBallotView(
    List<String> approvedOptionIds,
    Map<String, String> judgments
) {}
