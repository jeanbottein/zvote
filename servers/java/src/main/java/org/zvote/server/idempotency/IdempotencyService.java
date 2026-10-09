package org.zvote.server.idempotency;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.common.InvalidRequestException;

import java.time.OffsetDateTime;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Runs a request's work once per Idempotency-Key, and answers what it answered
 * the first time.
 *
 * What is kept is the share token of the poll the request acted on, never a
 * copy of the answer: a replay is composed afresh, so it is never a stale
 * reading of a poll that has moved on.
 *
 * The work runs inside this transaction, and the key is written in it too, so
 * the two commit together or not at all. Two requests carrying the same key at
 * the same instant both find nothing kept and both do the work; the second to
 * commit breaks the primary key, its work is rolled back, and it is told the
 * change collided - which, sent again, finds the key and replays.
 */
@Service
public class IdempotencyService {

    /** As in the IETF draft of the same name. */
    public static final String HEADER = "Idempotency-Key";

    private static final Pattern KEY = Pattern.compile("[!-~]{1,64}");

    private final JdbcClient jdbc;

    IdempotencyService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * @param key  the caller's Idempotency-Key, or null to make no promise
     * @param work what to do, answering the share token of the poll it acted on
     */
    @Transactional
    public String once(String voterId, String key, Supplier<String> work) {
        if (key == null) {
            return work.get();
        }
        var requestKey = valid(key);
        var kept = jdbc.sql("""
                SELECT share_token FROM idempotent_request WHERE voter_id = :voter AND request_key = :key
                """)
            .param("voter", voterId)
            .param("key", requestKey)
            .query(String.class)
            .optional();
        if (kept.isPresent()) {
            return kept.get();
        }
        var shareToken = work.get();
        jdbc.sql("""
                INSERT INTO idempotent_request (voter_id, request_key, share_token, created_at)
                VALUES (:voter, :key, :token, :now)
                """)
            .param("voter", voterId)
            .param("key", requestKey)
            .param("token", shareToken)
            .param("now", OffsetDateTime.now())
            .update();
        return shareToken;
    }

    /** Keys older than the window a client would still be retrying in. */
    public int forget(OffsetDateTime before) {
        return jdbc.sql("DELETE FROM idempotent_request WHERE created_at < :before")
            .param("before", before)
            .update();
    }

    private static String valid(String key) {
        if (!KEY.matcher(key).matches()) {
            throw new InvalidRequestException(
                "An " + HEADER + " is 1 to 64 printable characters without spaces, such as a UUID.");
        }
        return key;
    }
}
