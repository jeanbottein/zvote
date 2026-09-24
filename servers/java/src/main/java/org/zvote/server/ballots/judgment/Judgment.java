package org.zvote.server.ballots.judgment;

import org.springframework.data.annotation.Id;

import java.time.Instant;

/** The mention one voter gave one option. */
public record Judgment(
    @Id Long id,
    Long pollId,
    Long optionId,
    String voterId,
    Mention mention,
    Instant castAt
) {}
