package org.zvote.server.polls;

import org.springframework.data.repository.ListCrudRepository;

import java.util.List;

interface PollOptionRepository extends ListCrudRepository<PollOption, Long> {

    List<PollOption> findByPollIdOrderByPosition(Long pollId);
}
