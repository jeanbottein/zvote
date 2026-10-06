package org.zvote.server.approval;

import org.springframework.data.annotation.Id;

/** One option one voter approved, stored under their ballot key: nothing that says who they are. */
record Approval(
    @Id Long id,
    Long pollId,
    Long optionId,
    String ballotKey
) {}
