package org.zvote.server.votemanagement;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.zvote.server.votemanagement.dto.CreateVoteInput;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class VoteService {

    private final VoteRepository voteRepository;
    private final VoteOptionRepository voteOptionRepository;
    
    // Real-time subscriptions using Reactor Sinks
    private final Map<UUID, Sinks.Many<Vote>> voteUpdateSinks = new ConcurrentHashMap<>();
    private final Sinks.Many<Vote> publicVoteSink = Sinks.many().multicast().onBackpressureBuffer();

    @Transactional
    public Mono<Vote> createVote(CreateVoteInput input, String creatorId, String ipAddress) {
        return validateVoteCreation(input)
            .then(Mono.defer(() -> {
                var publicId = UUID.randomUUID();
                var shareToken = generateShareToken(publicId);
                
                var vote = Vote.builder()
                    .publicId(publicId)
                    .creatorId(creatorId)
                    .title(normalizeTitle(input.title()))
                    .visibility(input.visibility() != null ? input.visibility() : Vote.Visibility.PUBLIC)
                    .votingSystem(input.votingSystem() != null ? input.votingSystem() : Vote.VotingSystem.MAJORITY_JUDGMENT)
                    .limitByIp(input.limitByIp())
                    .shareToken(shareToken)
                    .createdAt(Instant.now())
                    .build();
                
                return voteRepository.save(vote)
                    .flatMap(savedVote -> createVoteOptions(savedVote, input.options())
                        .then(Mono.just(savedVote)))
                    .doOnSuccess(this::publishVoteCreated);
            }));
    }

    @Transactional
    public Mono<Boolean> deleteVote(UUID publicId, String userId) {
        return voteRepository.findByPublicId(publicId)
            .filter(vote -> vote.creatorId().equals(userId))
            .flatMap(vote -> voteOptionRepository.deleteByVoteId(vote.id())
                .then(voteRepository.delete(vote))
                .thenReturn(true))
            .defaultIfEmpty(false);
    }

    public Mono<Vote> findByPublicId(UUID publicId) {
        return voteRepository.findByPublicId(publicId);
    }

    public Flux<Vote> findPublicVotes() {
        return voteRepository.findByVisibilityOrderByCreatedAtDesc(Vote.Visibility.PUBLIC);
    }

    public Flux<Vote> findVotesByCreator(String creatorId) {
        return voteRepository.findByCreatorIdOrderByCreatedAtDesc(creatorId);
    }

    public Flux<VoteOption> findOptionsByVoteId(Long voteId) {
        return voteOptionRepository.findByVoteIdOrderByOrderIndex(voteId);
    }

    /**
     * Subscribe to real-time updates for a specific vote
     * This is where we provide live updates unlike SpacetimeDB's limited subscription model
     */
    public Flux<Vote> subscribeToVoteUpdates(UUID publicId) {
        return Flux.defer(() -> {
            var sink = voteUpdateSinks.computeIfAbsent(
                publicId, 
                k -> Sinks.many().multicast().onBackpressureBuffer()
            );
            return sink.asFlux();
        });
    }

    /**
     * Subscribe to all new public votes (real-time)
     */
    public Flux<Vote> subscribeToPublicVotes() {
        return publicVoteSink.asFlux();
    }

    /**
     * Publish vote update to subscribers (called when vote changes)
     */
    public Mono<Void> publishVoteUpdate(Vote vote) {
        return Mono.fromRunnable(() -> {
            var sink = voteUpdateSinks.get(vote.publicId());
            if (sink != null) {
                sink.tryEmitNext(vote);
            }
        });
    }

    /**
     * Publish new public vote creation to subscribers
     */
    private void publishVoteCreated(Vote vote) {
        if (vote.visibility() == Vote.Visibility.PUBLIC) {
            publicVoteSink.tryEmitNext(vote);
        }
    }

    private Mono<Void> validateVoteCreation(CreateVoteInput input) {
        if (input.options() == null || input.options().size() < 2) {
            return Mono.error(new IllegalArgumentException("At least 2 options are required"));
        }
        
        if (input.options().size() > 20) {
            return Mono.error(new IllegalArgumentException("Maximum 20 options allowed"));
        }
        
        var uniqueOptions = input.options().stream()
            .map(String::trim)
            .map(String::toLowerCase)
            .distinct()
            .count();
            
        if (uniqueOptions != input.options().size()) {
            return Mono.error(new IllegalArgumentException("All options must be unique"));
        }
        
        return Mono.empty();
    }

    private Mono<Void> createVoteOptions(Vote vote, java.util.List<String> optionLabels) {
        var options = new java.util.ArrayList<VoteOption>();
        for (int i = 0; i < optionLabels.size(); i++) {
            var option = VoteOption.builder()
                .voteId(vote.id())
                .label(optionLabels.get(i).trim())
                .orderIndex(i)
                .approvalsCount(0)
                .build();
            options.add(option);
        }
        
        return voteOptionRepository.saveAll(options).then();
    }

    private String normalizeTitle(String title) {
        return title.trim();
    }

    private String generateShareToken(UUID publicId) {
        // Simple token generation - can be enhanced
        return publicId.toString().substring(0, 8);
    }
}
