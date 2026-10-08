package org.zvote.server.ballots;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

/**
 * The tallies of every poll: how many ballots it has, and how many give each
 * option each choice. They are stored, so that reading them costs the same
 * whatever the number of ballots, and kept up to date by folding in what
 * ballots changed (see {@link BallotBoxService}), a moment after they are
 * cast. Folding only adds and subtracts: tallies can always be rebuilt from
 * the ballots.
 */
@Service
public class TallyService {

    /** Folds lock counters in this order, so that two of them never wait for each other in a circle. */
    private static final Comparator<Counter> COUNTER_ORDER = Comparator.comparingLong(Counter::pollId)
        .thenComparingInt(Counter::position)
        .thenComparingInt(Counter::choice);

    private final JdbcClient jdbc;
    private final JdbcTemplate batches;

    public TallyService(JdbcClient jdbc, JdbcTemplate batches) {
        this.jdbc = jdbc;
        this.batches = batches;
    }

    /** A new poll starts at zero: {@code choices} counters for each of its {@code options}. */
    @Transactional
    public void open(long pollId, int options, int choices) {
        jdbc.sql("INSERT INTO ballot_count (poll_id, total) VALUES (:poll, 0)").param("poll", pollId).update();
        var rows = new ArrayList<Object[]>(options * choices);
        for (int position = 0; position < options; position++) {
            for (int choice = 0; choice < choices; choice++) {
                rows.add(new Object[] {pollId, position, choice});
            }
        }
        batches.batchUpdate("INSERT INTO tally (poll_id, position, choice, total) VALUES (?, ?, ?, 0)", rows);
    }

    public Tally tallyOf(long pollId) {
        var ballots = jdbc.sql("SELECT total FROM ballot_count WHERE poll_id = :poll")
            .param("poll", pollId)
            .query(Long.class).optional().orElse(0L);
        var counts = jdbc.sql("SELECT position, total FROM tally WHERE poll_id = :poll ORDER BY position, choice")
            .param("poll", pollId)
            .query((row, number) -> Map.entry(row.getInt(1), row.getLong(2)))
            .list().stream()
            .collect(Collectors.groupingBy(Map.Entry::getKey, TreeMap::new,
                Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
        return new Tally(ballots, List.copyOf(counts.values()));
    }

    /**
     * Folds up to {@code limit} changes into the tallies, in one transaction,
     * and returns the polls they belong to. Changes another server is folding
     * are left to it, so that servers fold side by side.
     */
    @Transactional
    public Set<Long> fold(int limit) {
        var changes = jdbc.sql("""
                SELECT id, poll_id, before, after FROM ballot_change ORDER BY id LIMIT :limit FOR UPDATE SKIP LOCKED
                """)
            .param("limit", limit)
            .query((row, number) -> new Change(row.getLong(1), row.getLong(2), row.getBytes(3), row.getBytes(4)))
            .list();
        if (changes.isEmpty()) {
            return Set.of();
        }
        var counters = new TreeMap<Counter, Long>(COUNTER_ORDER);
        var ballots = new TreeMap<Long, Long>();
        for (var change : changes) {
            count(change.pollId(), change.before(), -1, counters, ballots);
            count(change.pollId(), change.after(), 1, counters, ballots);
        }
        batches.batchUpdate("UPDATE tally SET total = total + ? WHERE poll_id = ? AND position = ? AND choice = ?",
            nonZero(counters, (counter, delta) -> new Object[] {delta, counter.pollId(), counter.position(),
                counter.choice()}));
        batches.batchUpdate("UPDATE ballot_count SET total = total + ? WHERE poll_id = ?",
            nonZero(ballots, (pollId, delta) -> new Object[] {delta, pollId}));
        jdbc.sql("DELETE FROM ballot_change WHERE id IN (:ids)")
            .param("ids", changes.stream().map(Change::id).toList())
            .update();
        return changes.stream().map(Change::pollId).collect(Collectors.toSet());
    }

    /** Adds (or, with a sign of -1, takes away) one ballot's choices; a null ballot counts for nothing. */
    private static void count(long pollId, byte[] choices, int sign,
                              Map<Counter, Long> counters, Map<Long, Long> ballots) {
        if (choices == null) {
            return;
        }
        ballots.merge(pollId, (long) sign, Long::sum);
        for (int position = 0; position < choices.length; position++) {
            counters.merge(new Counter(pollId, position, choices[position]), (long) sign, Long::sum);
        }
    }

    /** One batch row per delta that is not zero. */
    private static <K> List<Object[]> nonZero(Map<K, Long> deltas, BiFunction<K, Long, Object[]> row) {
        return deltas.entrySet().stream()
            .filter(delta -> delta.getValue() != 0)
            .map(delta -> row.apply(delta.getKey(), delta.getValue()))
            .toList();
    }

    /** Counts the ballots of a poll that give an option a choice. */
    private record Counter(long pollId, int position, int choice) {}

    private record Change(long id, long pollId, byte[] before, byte[] after) {}
}
