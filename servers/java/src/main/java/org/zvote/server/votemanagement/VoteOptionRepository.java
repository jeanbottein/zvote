package org.zvote.server.votemanagement;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface VoteOptionRepository extends R2dbcRepository<VoteOption, Long> {
    
    Flux<VoteOption> findByVoteIdOrderByOrderIndex(Long voteId);
    
    Mono<Void> deleteByVoteId(Long voteId);
}
