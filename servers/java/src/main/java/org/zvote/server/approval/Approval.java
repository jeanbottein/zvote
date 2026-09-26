package org.zvote.server.ballots.approval;

import org.springframework.data.annotation.Id;

import java.time.Instant;

/** One option one voter approved. */
public record Approval(
    @Id Long id,
    Long pollId,
    Long optionId,
    String voterId,
    Instant castAt
) {}
