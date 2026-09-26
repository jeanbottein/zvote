package org.zvote.server.judgment;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;

interface JudgmentRepository extends ListCrudRepository<Judgment, Long> {

    List<Judgment> findByPollIdAndVoterId(Long pollId, String voterId);

    /**
     * One statement. A derived deleteBy... loads the rows and deletes them one
     * by one, and fails with "Incorrect result size: expected 1, actual 3" as
     * soon as a ballot grades more than one option.
     */
    @Modifying
    @Query("DELETE FROM judgment WHERE poll_id = :pollId AND voter_id = :voterId")
    void deleteBallot(Long pollId, String voterId);

    /** Every tally of a poll in one query: seven per option at most. */
    @Query("""
        SELECT option_id, mention, COUNT(*) AS total
        FROM judgment
        WHERE poll_id = :pollId
        GROUP BY option_id, mention
        """)
    List<JudgmentCount> countByOptionAndMention(Long pollId);

    @Query("SELECT COUNT(DISTINCT voter_id) FROM judgment WHERE poll_id = :pollId")
    long countBallots(Long pollId);
}
