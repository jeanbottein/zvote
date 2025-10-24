package org.zvote.server.votingsystems.approvalvoting;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.votemanagement.Vote;
import org.zvote.server.votemanagement.VoteOption;
import org.zvote.server.votemanagement.VoteOptionRepository;
import org.zvote.server.votemanagement.VoteRepository;
import org.zvote.server.votemanagement.VoteService;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApprovalService {

    private final ApprovalRepository approvalRepository;
    private final VoteRepository voteRepository;
    private final VoteOptionRepository voteOptionRepository;
    private final VoteService voteService;

    /**
     * Set the complete approval ballot for a voter.
     * This replaces any existing approvals with the new set.
     * 
     * @param voteId The vote's public ID
     * @param optionIds List of option IDs to approve
     * @param voterId The voter's identity
     * @return Mono completing when ballot is set
     */
    @Transactional
    public Mono<Void> setApprovals(UUID voteId, List<Long> optionIds, String voterId) {
        return voteRepository.findByPublicId(voteId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Vote not found")))
            .flatMap(vote -> validateVoteForApproval(vote)
                .then(validateOptions(vote.id(), optionIds))
                .then(updateApprovals(vote, optionIds, voterId)))
            .then();
    }

    /**
     * Approve a single option (add to ballot)
     */
    @Transactional
    public Mono<Void> approve(UUID voteId, Long optionId, String voterId) {
        return voteRepository.findByPublicId(voteId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Vote not found")))
            .flatMap(vote -> validateVoteForApproval(vote)
                .then(validateOption(vote.id(), optionId))
                .then(approvalRepository.existsByVoterIdAndOptionId(voterId, optionId))
                .flatMap(exists -> {
                    if (exists) {
                        return Mono.empty(); // Already approved
                    }
                    var approval = Approval.builder()
                        .voteId(vote.id())
                        .optionId(optionId)
                        .voterId(voterId)
                        .createdAt(Instant.now())
                        .build();
                    return approvalRepository.save(approval)
                        .then(incrementApprovalCount(optionId))
                        .then(voteService.publishVoteUpdate(vote));
                }))
            .then();
    }

    /**
     * Unapprove a single option (remove from ballot)
     */
    @Transactional
    public Mono<Void> unapprove(UUID voteId, Long optionId, String voterId) {
        return voteRepository.findByPublicId(voteId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Vote not found")))
            .flatMap(vote -> approvalRepository.deleteByVoterIdAndOptionId(voterId, optionId)
                .then(decrementApprovalCount(optionId))
                .then(voteService.publishVoteUpdate(vote)))
            .then();
    }

    /**
     * Get voter's current approvals for a vote
     */
    public Flux<Approval> getVoterApprovals(UUID voteId, String voterId) {
        return voteRepository.findByPublicId(voteId)
            .flatMapMany(vote -> approvalRepository.findByVoteIdAndVoterId(vote.id(), voterId));
    }

    /**
     * Get all approvals for an option
     */
    public Flux<Approval> getOptionApprovals(Long optionId) {
        return approvalRepository.findByOptionId(optionId);
    }

    private Mono<Void> validateVoteForApproval(Vote vote) {
        if (vote.votingSystem() != Vote.VotingSystem.APPROVAL) {
            return Mono.error(new IllegalArgumentException(
                "This vote does not use approval voting"));
        }
        return Mono.empty();
    }

    private Mono<Void> validateOptions(Long voteId, List<Long> optionIds) {
        if (optionIds.isEmpty()) {
            return Mono.empty(); // Empty ballot is valid (withdraw all)
        }
        
        if (optionIds.size() > 20) {
            return Mono.error(new IllegalArgumentException(
                "Cannot approve more than 20 options"));
        }
        
        // Verify all options belong to this vote
        return voteOptionRepository.findByVoteIdOrderByOrderIndex(voteId)
            .map(VoteOption::id)
            .collectList()
            .flatMap(validIds -> {
                var invalidOptions = optionIds.stream()
                    .filter(id -> !validIds.contains(id))
                    .toList();
                
                if (!invalidOptions.isEmpty()) {
                    return Mono.error(new IllegalArgumentException(
                        "Some options do not belong to this vote: " + invalidOptions));
                }
                return Mono.empty();
            });
    }

    private Mono<Void> validateOption(Long voteId, Long optionId) {
        return voteOptionRepository.findById(optionId)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Option not found")))
            .flatMap(option -> {
                if (!option.voteId().equals(voteId)) {
                    return Mono.error(new IllegalArgumentException(
                        "Option does not belong to this vote"));
                }
                return Mono.empty();
            });
    }

    /**
     * Core logic: Update approvals to match desired set
     */
    private Mono<Void> updateApprovals(Vote vote, List<Long> desiredIds, String voterId) {
        return approvalRepository.findByVoteIdAndVoterId(vote.id(), voterId)
            .map(Approval::optionId)
            .collectList()
            .flatMap(currentIds -> {
                var current = new HashSet<>(currentIds);
                var desired = new HashSet<>(desiredIds);
                
                var toAdd = new HashSet<>(desired);
                toAdd.removeAll(current);
                
                var toRemove = new HashSet<>(current);
                toRemove.removeAll(desired);
                
                return removeApprovals(toRemove, voterId)
                    .then(addApprovals(vote.id(), toAdd, voterId))
                    .then(voteService.publishVoteUpdate(vote));
            });
    }

    private Mono<Void> addApprovals(Long voteId, Set<Long> optionIds, String voterId) {
        if (optionIds.isEmpty()) {
            return Mono.empty();
        }
        
        var approvals = optionIds.stream()
            .map(optionId -> Approval.builder()
                .voteId(voteId)
                .optionId(optionId)
                .voterId(voterId)
                .createdAt(Instant.now())
                .build())
            .toList();
        
        return approvalRepository.saveAll(approvals)
            .flatMap(approval -> incrementApprovalCount(approval.optionId()))
            .then();
    }

    private Mono<Void> removeApprovals(Set<Long> optionIds, String voterId) {
        if (optionIds.isEmpty()) {
            return Mono.empty();
        }
        
        return Flux.fromIterable(optionIds)
            .flatMap(optionId -> approvalRepository.deleteByVoterIdAndOptionId(voterId, optionId)
                .then(decrementApprovalCount(optionId)))
            .then();
    }

    private Mono<Void> incrementApprovalCount(Long optionId) {
        return voteOptionRepository.findById(optionId)
            .flatMap(option -> {
                var updated = option.withApprovalsCount(option.approvalsCount() + 1);
                return voteOptionRepository.save(updated);
            })
            .then();
    }

    private Mono<Void> decrementApprovalCount(Long optionId) {
        return voteOptionRepository.findById(optionId)
            .flatMap(option -> {
                var newCount = Math.max(0, option.approvalsCount() - 1);
                var updated = option.withApprovalsCount(newCount);
                return voteOptionRepository.save(updated);
            })
            .then();
    }
}
