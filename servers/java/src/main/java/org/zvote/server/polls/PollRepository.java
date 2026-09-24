package org.zvote.server.polls;

import org.springframework.data.repository.ListCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PollRepository extends ListCrudRepository<Poll, Long> {

    Optional<Poll> findByShareToken(String shareToken);

    List<Poll> findTop50ByVisibilityOrderByCreatedAtDesc(Poll.Visibility visibility);

    List<Poll> findTop100ByCreatorIdOrderByCreatedAtDesc(String creatorId);
}
