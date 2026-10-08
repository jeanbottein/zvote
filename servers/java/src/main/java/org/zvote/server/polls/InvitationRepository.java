package org.zvote.server.polls;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.Optional;

interface InvitationRepository extends ListCrudRepository<Invitation, Long> {

    List<Invitation> findByPollIdOrderById(Long pollId);

    Optional<Invitation> findByPollIdAndToken(Long pollId, String token);

    boolean existsByPollIdAndToken(Long pollId, String token);

    boolean existsByPollIdAndUsedBy(Long pollId, String usedBy);

    long countByPollId(Long pollId);

    /** Marks the invitation used by this key, unless something already did. */
    @Modifying
    @Query("UPDATE invitation SET used_by = :usedBy WHERE id = :id AND used_by IS NULL")
    boolean use(Long id, String usedBy);

    @Modifying
    @Query("DELETE FROM invitation WHERE poll_id = :pollId AND token = :token AND used_by IS NULL")
    boolean deleteUnused(Long pollId, String token);
}
