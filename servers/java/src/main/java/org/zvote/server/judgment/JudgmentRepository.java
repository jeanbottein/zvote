package org.zvote.server.judgment;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;

interface JudgmentRepository extends ListCrudRepository<Judgment, Long> {

    List<Judgment> findByPollIdAndBallotKey(Long pollId, String ballotKey);

    /**
     * One statement. A derived deleteBy... loads the rows and deletes them one
     * by one, and fails with "Incorrect result size: expected 1, actual 3" as
     * soon as a ballot grades more than one option.
     */
    @Modifying
    @Query("DELETE FROM judgment WHERE poll_id = :pollId AND ballot_key = :ballotKey")
    void deleteBallot(Long pollId, String ballotKey);

    /** Every tally of a poll in one query: seven per option at most. */
    @Query("""
        SELECT option_id, mention, COUNT(*) AS total
        FROM judgment
        WHERE poll_id = :pollId
        GROUP BY option_id, mention
        """)
    List<JudgmentCount> countByOptionAndMention(Long pollId);

    @Query("SELECT COUNT(DISTINCT ballot_key) FROM judgment WHERE poll_id = :pollId")
    long countBallots(Long pollId);
}
