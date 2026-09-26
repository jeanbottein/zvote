package org.zvote.server.judgment;

/** How many voters gave one option one mention. */
record JudgmentCount(Long optionId, Mention mention, long total) {}
