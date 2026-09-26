package org.zvote.server.polls;

import org.springframework.data.relational.core.sql.LockMode;
import org.springframework.data.relational.repository.Lock;
import org.springframework.data.repository.ListCrudRepository;

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

    List<Poll> findTop50ByVisibilityOrderByCreatedAtDesc(Poll.Visibility visibility);

    List<Poll> findTop100ByCreatorIdOrderByCreatedAtDesc(String creatorId);
}
