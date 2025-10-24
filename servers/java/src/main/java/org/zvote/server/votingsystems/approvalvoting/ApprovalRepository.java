package org.zvote.server.votingsystems.approvalvoting;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface ApprovalRepository extends R2dbcRepository<Approval, Long> {
    
    /**
     * Find all approvals for a specific vote by a specific voter
     */
    Flux<Approval> findByVoteIdAndVoterId(Long voteId, String voterId);
    
    /**
     * Find all approvals for a specific option
     */
    Flux<Approval> findByOptionId(Long optionId);
    
    /**
     * Find all approvals for a vote
     */
    Flux<Approval> findByVoteId(Long voteId);
    
    /**
     * Delete all approvals for a vote (cascade delete)
     */
    Mono<Void> deleteByVoteId(Long voteId);
    
    /**
     * Delete a specific approval by voter and option
     */
    Mono<Void> deleteByVoterIdAndOptionId(String voterId, Long optionId);
    
    /**
     * Check if voter has already approved an option
     */
    Mono<Boolean> existsByVoterIdAndOptionId(String voterId, Long optionId);
}
