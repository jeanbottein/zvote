package org.zvote.server.ballots.approval;

/** How many voters approved one option. */
public record ApprovalCount(Long optionId, long total) {}
