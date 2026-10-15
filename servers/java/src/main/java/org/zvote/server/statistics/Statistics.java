package org.zvote.server.statistics;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything counted until {@code asOf}: totals; where, by time zone and by
 * region, for those with at least {@value StatisticsService#VISIBLE}
 * voters; and the last days, by UTC day. What came without a known time zone
 * counts in the totals only.
 */
public record Statistics(Instant asOf, long polls, long openPolls, long ballots, long voters,
                         List<Place> places, List<Region> regions, List<Day> days) {

    /** A time zone, as named in tzdata's zone.tab (Europe/Paris), and what was counted in it. */
    public record Place(String timeZone, long polls, long ballots, long voters) {
    }

    /** The first part of time zone names (Europe, America, Pacific): a continent or an ocean. */
    public record Region(String region, long polls, long ballots, long voters) {
    }

    public record Day(LocalDate day, long polls, long ballots, long voters) {
    }
}
