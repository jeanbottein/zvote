package org.zvote.server.approval;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;

interface ApprovalRepository extends ListCrudRepository<Approval, Long> {

    List<Approval> findByPollIdAndVoterId(Long pollId, String voterId);

    /** One statement; see JudgmentRepository#deleteBallot for why it is not derived. */
    @Modifying
    @Query("DELETE FROM approval WHERE poll_id = :pollId AND voter_id = :voterId")
    void deleteBallot(Long pollId, String voterId);

    /** Every tally of a poll in one query. */
    @Query("""
        SELECT option_id, COUNT(*) AS total
        FROM approval
        WHERE poll_id = :pollId
        GROUP BY option_id
        """)
    List<ApprovalCount> countByOption(Long pollId);

    @Query("SELECT COUNT(DISTINCT voter_id) FROM approval WHERE poll_id = :pollId")
    long countBallots(Long pollId);
}
