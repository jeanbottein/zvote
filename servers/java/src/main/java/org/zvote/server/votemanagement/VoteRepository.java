package org.zvote.server.votemanagement;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Repository
public interface VoteRepository extends R2dbcRepository<Vote, Long> {
    
    Mono<Vote> findByPublicId(UUID publicId);
    
    Mono<Vote> findByShareToken(String token);
    
    Flux<Vote> findByCreatorIdOrderByCreatedAtDesc(String creatorId);
    
    Flux<Vote> findByVisibilityOrderByCreatedAtDesc(Vote.Visibility visibility);
}
