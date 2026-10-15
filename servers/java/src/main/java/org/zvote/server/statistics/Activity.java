package org.zvote.server.statistics;

/** What the statistics count. */
public enum Activity {
    /** A poll was created. */
    POLL,
    /** A voter cast a ballot on a poll where they held none. Changing it is not another one. */
    BALLOT,
    /** A browser or a client got a voter identity: as near to "a person" as zvote knows. */
    VOTER
}
