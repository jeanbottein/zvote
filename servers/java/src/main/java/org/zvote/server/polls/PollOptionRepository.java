package org.zvote.server.polls;

import org.springframework.data.repository.ListCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PollOptionRepository extends ListCrudRepository<PollOption, Long> {

    List<PollOption> findByPollIdOrderByPosition(Long pollId);
}
