package org.zvote.server.polls;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.relational.core.sql.LockMode;
import org.springframework.data.relational.repository.Lock;
import org.springframework.data.repository.ListCrudRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

interface PollRepository extends ListCrudRepository<Poll, Long> {

    Optional<Poll> findByShareToken(String shareToken);

    /**
     * The same, holding a shared lock on the poll until the transaction ends
     * (FOR SHARE on PostgreSQL; H2 only has FOR UPDATE): ballots do not wait
     * for each other, but closing or deleting the poll waits for them.
     */
    @Lock(LockMode.PESSIMISTIC_READ)
    Optional<Poll> findLockedByShareToken(String shareToken);

    Optional<Poll> findByJoinCode(String joinCode);

    boolean existsByJoinCode(String joinCode);

    @Query("SELECT id FROM poll WHERE created_at < :cutoff")
    List<Long> findIdsCreatedBefore(Instant cutoff);

    /** One statement: their options and tallies go with them (ON DELETE CASCADE), their ballots later. */
    @Modifying
    @Query("DELETE FROM poll WHERE created_at < :cutoff")
    void deleteCreatedBefore(Instant cutoff);

    @Modifying
    @Query("INSERT INTO poll_removal (poll_id) VALUES (:pollId)")
    void scheduleRemoval(Long pollId);

    @Modifying
    @Query("INSERT INTO poll_removal (poll_id) SELECT id FROM poll WHERE created_at < :cutoff")
    void scheduleRemovalsCreatedBefore(Instant cutoff);

    @Query("SELECT poll_id FROM poll_removal")
    List<Long> findRemovals();

    @Modifying
    @Query("DELETE FROM poll_removal WHERE poll_id = :pollId")
    void removalDone(Long pollId);

    List<Poll> findTop50ByVisibilityOrderByCreatedAtDesc(Poll.Visibility visibility);

    List<Poll> findTop100ByCreatorIdOrderByCreatedAtDesc(String creatorId);
}
