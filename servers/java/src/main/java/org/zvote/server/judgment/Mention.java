package org.zvote.server.ballots.judgment;

import java.util.Arrays;
import java.util.Optional;

/**
 * The graded scale of majority judgment, ordered worst to best.
 *
 * The wire names are canonical across the whole system: the API, the client's
 * majorityJudgment.ts and the colour ramp in majority-judgment.css all use
 * exactly these seven spellings. Renaming one means renaming all of them.
 */
public enum Mention {
    BAD("Bad"),
    INADEQUATE("Inadequate"),
    PASSABLE("Passable"),
    FAIR("Fair"),
    GOOD("Good"),
    VERY_GOOD("VeryGood"),
    EXCELLENT("Excellent");

    private final String wireName;

    Mention(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }

    public static Optional<Mention> fromWireName(String wireName) {
        return Arrays.stream(values())
            .filter(mention -> mention.wireName.equals(wireName))
            .findFirst();
    }
}
