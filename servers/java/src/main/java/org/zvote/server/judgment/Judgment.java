package org.zvote.server.judgment;

import org.springframework.data.annotation.Id;

/** The mention one voter gave one option, stored under their ballot key: nothing that says who they are. */
record Judgment(
    @Id Long id,
    Long pollId,
    Long optionId,
    String ballotKey,
    Mention mention
) {}
