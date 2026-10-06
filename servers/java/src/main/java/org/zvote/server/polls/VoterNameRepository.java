package org.zvote.server.polls;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.Optional;

interface VoterNameRepository extends ListCrudRepository<VoterName, Long> {

    Optional<VoterName> findByPollIdAndNameKey(Long pollId, String nameKey);

    List<VoterName> findByPollId(Long pollId);

    @Modifying
    @Query("DELETE FROM voter_name WHERE poll_id = :pollId AND name_key = :nameKey")
    void deleteName(Long pollId, String nameKey);
}
