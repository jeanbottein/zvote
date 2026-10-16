package org.zvote.server.statistics;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.zvote.server.polls.PollService;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.function.BiConsumer;
import java.util.function.ToLongFunction;

/**
 * Counts what happens, by time zone, by day and for each poll, and publishes
 * the totals once an hour.
 *
 * The place is the time zone the browser sends ({@value #TIME_ZONE_HEADER}:
 * Europe/Paris), read from the request being served and never kept with
 * anything else: the server looks at no address, and names no country. A
 * request without a known time zone counts in the totals only.
 *
 * Counting costs an addition in memory, so voting never waits on a counter.
 * The counts are written once an hour, and only then shown: published as
 * they happened, a creator could match "a ballot from Reykjavik at 14:02"
 * with the one their poll received at 14:02. For the same reason a place or
 * a region shows only once it counts at least {@value #VISIBLE}. What was
 * counted since the last hour is written at shutdown; a crash loses it, which
 * statistics can afford.
 */
@Service
public class StatisticsService {

    /** The browser's IANA time zone, which every request from the web app carries. */
    public static final String TIME_ZONE_HEADER = "Zvote-Time-Zone";

    /** How much a place or a region must count before it shows: fewer could point at someone. */
    public static final int VISIBLE = 3;

    /** How many days the statistics go back. */
    static final int DAYS = 90;

    /** Where a request without a known time zone counts (CLDR's name for it). */
    static final String UNKNOWN = "Etc/Unknown";

    private static final Logger log = LoggerFactory.getLogger(StatisticsService.class);

    private final JdbcClient jdbc;
    private final PollService polls;
    private final Clock clock = Clock.systemUTC();
    private final Map<String, Counts> byPlace = new ConcurrentHashMap<>();
    private final Map<LocalDate, Counts> byDay = new ConcurrentHashMap<>();
    private final Map<PollPlace, LongAdder> byPoll = new ConcurrentHashMap<>();
    private volatile Statistics published;

    StatisticsService(JdbcClient jdbc, PollService polls) {
        this.jdbc = jdbc;
        this.polls = polls;
    }

    /** Counts one activity, where the request being served comes from, today, once it is committed. */
    public void count(Activity activity) {
        var place = placeOfCurrentRequest();
        var day = LocalDate.now(clock);
        onceCommitted(() -> {
            byPlace.computeIfAbsent(place, key -> new Counts()).add(activity, 1);
            byDay.computeIfAbsent(day, key -> new Counts()).add(activity, 1);
        });
    }

    /**
     * Counts a change to a poll's ballots, where the request comes from, once
     * it is committed: 1 for a voter's first ballot on it (an activity too),
     * -1 for one withdrawn.
     */
    public void countBallots(long pollId, int change) {
        if (change > 0) {
            count(Activity.BALLOT);
        }
        if (change != 0) {
            var key = new PollPlace(pollId, placeOfCurrentRequest());
            onceCommitted(() -> byPoll.computeIfAbsent(key, any -> new LongAdder()).add(change));
        }
    }

    /**
     * Inside a transaction, after it commits: a ballot rolled back (its
     * voter's name was refused, say) was never cast, and sent again would
     * count twice.
     */
    private static void onceCommitted(Runnable counting) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    counting.run();
                }
            });
        } else {
            counting.run();
        }
    }

    /** What was published last: the counts as of the last hour. */
    public Statistics current() {
        var statistics = published;
        return statistics != null ? statistics : publish();
    }

    /** Where a poll's ballots come from, as of the last hour; nothing while its results are not shown. */
    public PollPlaces placesOf(long pollId, boolean shown) {
        var asOf = current().asOf();
        if (!shown) {
            return new PollPlaces(asOf, null, null);
        }
        var rows = jdbc.sql("SELECT time_zone, ballots FROM poll_place WHERE poll_id = :poll")
            .param("poll", pollId)
            .query((row, number) -> new PollPlaces.Place(row.getString("time_zone"), Math.max(0, row.getLong("ballots"))))
            .list()
            .stream().filter(place -> !place.timeZone().equals(UNKNOWN))
            .toList();
        var regions = new TreeMap<String, Long>();
        rows.forEach(place -> regions.merge(regionOf(place.timeZone()), place.ballots(), Long::sum));
        return new PollPlaces(
            asOf,
            rows.stream().filter(place -> place.ballots() >= VISIBLE)
                .sorted(Comparator.comparingLong(PollPlaces.Place::ballots).reversed()
                    .thenComparing(PollPlaces.Place::timeZone))
                .toList(),
            regions.entrySet().stream().filter(region -> region.getValue() >= VISIBLE)
                .map(region -> new PollPlaces.Region(region.getKey(), region.getValue()))
                .toList());
    }

    /** Writes what was counted since the last time, and publishes the totals. */
    @Scheduled(cron = "${zvote.statistics-cron}")
    public void flush() {
        write();
        publish();
    }

    @PreDestroy
    void write() {
        drain(byPlace, (place, counts) -> add("activity_by_place", "time_zone", place, counts));
        drain(byDay, (day, counts) -> add("activity_by_day", "utc_day", day, counts));
        byPoll.forEach((key, adder) -> {
            long change = adder.sumThenReset();
            if (change == 0) {
                byPoll.remove(key, adder); // idle for an hour
                return;
            }
            try {
                addToPoll(key, change);
            } catch (DataIntegrityViolationException pollDeleted) {
                // Its places went with it.
            } catch (RuntimeException e) {
                adder.add(change);
                log.warn("Could not write the statistics", e);
            }
        });
    }

    static String placeOf(String timeZone) {
        return timeZone == null ? UNKNOWN : TimeZones.CANONICAL.getOrDefault(timeZone, UNKNOWN);
    }

    static String regionOf(String timeZone) {
        return timeZone.substring(0, timeZone.indexOf('/'));
    }

    private static String placeOfCurrentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
            ? placeOf(attributes.getRequest().getHeader(TIME_ZONE_HEADER))
            : UNKNOWN;
    }

    private <K> void drain(Map<K, Counts> pending, BiConsumer<K, long[]> writer) {
        pending.forEach((key, counts) -> {
            var drained = counts.drain();
            if (drained[0] + drained[1] + drained[2] == 0) {
                pending.remove(key, counts); // idle for an hour
                return;
            }
            try {
                writer.accept(key, drained);
            } catch (RuntimeException e) {
                counts.restore(drained);
                log.warn("Could not write the statistics", e);
            }
        });
    }

    /** Adds to a row, which another server may be creating at the same moment. */
    private void add(String table, String keyColumn, Object key, long[] counts) {
        var update = "UPDATE " + table + " SET polls = polls + :polls, ballots = ballots + :ballots,"
            + " voters = voters + :voters WHERE " + keyColumn + " = :key";
        if (withCounts(jdbc.sql(update), key, counts).update() == 0) {
            try {
                withCounts(jdbc.sql("INSERT INTO " + table + " (" + keyColumn + ", polls, ballots, voters)"
                    + " VALUES (:key, :polls, :ballots, :voters)"), key, counts).update();
            } catch (DuplicateKeyException anotherServerWasFirst) {
                withCounts(jdbc.sql(update), key, counts).update();
            }
        }
    }

    private static JdbcClient.StatementSpec withCounts(JdbcClient.StatementSpec statement, Object key, long[] counts) {
        return statement.param("key", key).param("polls", counts[0]).param("ballots", counts[1])
            .param("voters", counts[2]);
    }

    private void addToPoll(PollPlace key, long change) {
        var update = jdbc.sql("UPDATE poll_place SET ballots = ballots + :change"
                + " WHERE poll_id = :poll AND time_zone = :zone")
            .param("change", change).param("poll", key.pollId()).param("zone", key.timeZone());
        if (update.update() == 0) {
            try {
                jdbc.sql("INSERT INTO poll_place (poll_id, time_zone, ballots) VALUES (:poll, :zone, :change)")
                    .param("change", change).param("poll", key.pollId()).param("zone", key.timeZone())
                    .update();
            } catch (DuplicateKeyException anotherServerWasFirst) {
                update.update();
            }
        }
    }

    private synchronized Statistics publish() {
        var places = jdbc.sql("SELECT time_zone, polls, ballots, voters FROM activity_by_place")
            .query((row, number) -> new Statistics.Place(row.getString("time_zone"), row.getLong("polls"),
                row.getLong("ballots"), row.getLong("voters")))
            .list();
        var since = LocalDate.now(clock).minusDays(DAYS - 1);
        var days = jdbc.sql("SELECT utc_day, polls, ballots, voters FROM activity_by_day WHERE utc_day >= :since"
                + " ORDER BY utc_day")
            .param("since", since)
            .query((row, number) -> new Statistics.Day(row.getObject("utc_day", LocalDate.class),
                row.getLong("polls"), row.getLong("ballots"), row.getLong("voters")))
            .list();
        var known = places.stream().filter(place -> !place.timeZone().equals(UNKNOWN)).toList();
        var regions = new TreeMap<String, long[]>();
        known.forEach(place -> {
            var sums = regions.computeIfAbsent(regionOf(place.timeZone()), region -> new long[3]);
            sums[0] += place.polls();
            sums[1] += place.ballots();
            sums[2] += place.voters();
        });
        var statistics = new Statistics(
            Instant.now(clock),
            sum(places, Statistics.Place::polls),
            polls.countOpen(),
            sum(places, Statistics.Place::ballots),
            sum(places, Statistics.Place::voters),
            known.stream()
                .filter(place -> place.voters() >= VISIBLE)
                .sorted(Comparator.comparingLong(Statistics.Place::voters).reversed()
                    .thenComparing(Statistics.Place::timeZone))
                .toList(),
            regions.entrySet().stream()
                .filter(region -> region.getValue()[2] >= VISIBLE)
                .map(region -> new Statistics.Region(region.getKey(), region.getValue()[0], region.getValue()[1],
                    region.getValue()[2]))
                .toList(),
            days);
        published = statistics;
        return statistics;
    }

    private static long sum(List<Statistics.Place> places, ToLongFunction<Statistics.Place> count) {
        return places.stream().mapToLong(count).sum();
    }

    private record PollPlace(long pollId, String timeZone) {
    }

    private static final class Counts {
        final LongAdder polls = new LongAdder();
        final LongAdder ballots = new LongAdder();
        final LongAdder voters = new LongAdder();

        void add(Activity activity, long count) {
            switch (activity) {
                case POLL -> polls.add(count);
                case BALLOT -> ballots.add(count);
                case VOTER -> voters.add(count);
            }
        }

        long[] drain() {
            return new long[] {polls.sumThenReset(), ballots.sumThenReset(), voters.sumThenReset()};
        }

        void restore(long[] counts) {
            polls.add(counts[0]);
            ballots.add(counts[1]);
            voters.add(counts[2]);
        }
    }
}
