package org.zvote.server.approval;

import org.springframework.data.annotation.Id;

import java.time.Instant;

/** One option one voter approved. */
record Approval(
    @Id Long id,
    Long pollId,
    Long optionId,
    String voterId,
    Instant castAt
) {}
