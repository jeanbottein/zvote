package org.zvote.server.approval;

/** How many voters approved one option. */
record ApprovalCount(Long optionId, long total) {}
