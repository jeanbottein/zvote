package org.zvote.server.ballots;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.util.Arrays;

/**
 * The ballots themselves: one row per voter and poll, holding one byte per
 * option. Casting replaces a voter's whole ballot, and records what changed,
 * from what to what, for {@link TallyService} to fold into the tallies: voting
 * only ever inserts that record, so ballots never wait for each other on a
 * counter.
 *
 * A ballot is stored under its ballot key (see identity.Voter): nothing here
 * knows who cast it.
 */
@Service
public class BallotBoxService {

    private final JdbcClient jdbc;

    public BallotBoxService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** This voter's choices on the poll, one byte per option; null if they have no ballot. */
    public byte[] choicesOf(long pollId, String ballotKey) {
        return jdbc.sql("SELECT choices FROM ballot WHERE poll_id = :poll AND ballot_key = :key")
            .param("poll", pollId)
            .param("key", ballotKey)
            .query(byte[].class).optional().orElse(null);
    }

    /**
     * Replaces this voter's ballot; no choices withdraws it. Runs in the
     * caller's transaction, which holds the poll open until it ends.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void cast(long pollId, String ballotKey, byte[] choices) {
        var before = jdbc.sql("SELECT choices FROM ballot WHERE poll_id = :poll AND ballot_key = :key FOR UPDATE")
            .param("poll", pollId)
            .param("key", ballotKey)
            .query(byte[].class).optional().orElse(null);
        var after = choices.length == 0 ? null : choices;
        if (Arrays.equals(before, after)) {
            return;
        }
        String write;
        if (after == null) {
            write = "DELETE FROM ballot WHERE poll_id = :poll AND ballot_key = :key";
        } else if (before == null) {
            write = "INSERT INTO ballot (poll_id, ballot_key, choices) VALUES (:poll, :key, :choices)";
        } else {
            write = "UPDATE ballot SET choices = :choices WHERE poll_id = :poll AND ballot_key = :key";
        }
        jdbc.sql(write).param("poll", pollId).param("key", ballotKey).param("choices", after, Types.BINARY).update();
        jdbc.sql("INSERT INTO ballot_change (poll_id, before, after) VALUES (:poll, :before, :after)")
            .param("poll", pollId)
            .param("before", before, Types.BINARY)
            .param("after", after, Types.BINARY)
            .update();
    }

    /** Removes up to {@code limit} ballots of a deleted poll, in one transaction; returns how many. */
    @Transactional
    public int removeSome(long pollId, int limit) {
        return jdbc.sql("""
                DELETE FROM ballot WHERE poll_id = :poll AND ballot_key IN (
                    SELECT ballot_key FROM ballot WHERE poll_id = :poll LIMIT :limit)
                """)
            .param("poll", pollId)
            .param("limit", limit)
            .update();
    }
}
