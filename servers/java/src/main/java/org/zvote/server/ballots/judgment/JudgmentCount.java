package org.zvote.server.ballots.judgment;

/** How many voters gave one option one mention. */
public record JudgmentCount(Long optionId, Mention mention, long total) {}
