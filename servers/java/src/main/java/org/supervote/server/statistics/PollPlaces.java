package org.supervote.server.statistics;

import java.time.Instant;
import java.util.List;

/**
 * Where one poll's ballots come from, as of {@code asOf}: the time zones and
 * regions with at least {@value StatisticsService#VISIBLE} ballots. Null
 * while the poll keeps its results back.
 */
public record PollPlaces(Instant asOf, List<Place> places, List<Region> regions) {

    public record Place(String timeZone, long ballots) {
    }

    public record Region(String region, long ballots) {
    }
}
