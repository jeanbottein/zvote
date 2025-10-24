package org.zvote.server.votemanagement;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.zvote.server.votemanagement.dto.CreateVoteInput;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoteServiceTest {

    @Mock
    private VoteRepository voteRepository;

    @Mock
    private VoteOptionRepository voteOptionRepository;

    private VoteService voteService;

    @BeforeEach
    void setUp() {
        voteService = new VoteService(voteRepository, voteOptionRepository);
    }

    @Test
    void createVote_shouldCreateVoteSuccessfully() {
        // Given
        var input = CreateVoteInput.builder()
            .title("Best Pizza Topping")
            .options(List.of("Pepperoni", "Mushroom", "Pineapple"))
            .visibility(Vote.Visibility.PUBLIC)
            .votingSystem(Vote.VotingSystem.APPROVAL)
            .limitByIp(false)
            .build();

        var savedVote = Vote.builder()
            .id(1L)
            .publicId(UUID.randomUUID())
            .creatorId("user-123")
            .title("Best Pizza Topping")
            .visibility(Vote.Visibility.PUBLIC)
            .votingSystem(Vote.VotingSystem.APPROVAL)
            .limitByIp(false)
            .shareToken("abc123")
            .createdAt(Instant.now())
            .build();

        when(voteRepository.save(any(Vote.class))).thenReturn(Mono.just(savedVote));
        when(voteOptionRepository.saveAll(any(List.class))).thenReturn(reactor.core.publisher.Flux.empty());

        // When & Then
        StepVerifier.create(voteService.createVote(input, "user-123", "127.0.0.1"))
            .assertNext(vote -> {
                assertThat(vote.title()).isEqualTo("Best Pizza Topping");
                assertThat(vote.visibility()).isEqualTo(Vote.Visibility.PUBLIC);
                assertThat(vote.votingSystem()).isEqualTo(Vote.VotingSystem.APPROVAL);
            })
            .verifyComplete();
    }

    @Test
    void createVote_shouldRejectTooFewOptions() {
        // Given
        var input = CreateVoteInput.builder()
            .title("Invalid Vote")
            .options(List.of("Only One"))
            .build();

        // When & Then
        StepVerifier.create(voteService.createVote(input, "user-123", "127.0.0.1"))
            .expectErrorMatches(e -> 
                e instanceof IllegalArgumentException && 
                e.getMessage().contains("At least 2 options are required")
            )
            .verify();
    }

    @Test
    void createVote_shouldRejectDuplicateOptions() {
        // Given
        var input = CreateVoteInput.builder()
            .title("Duplicate Options")
            .options(List.of("Pizza", "Pizza", "Pasta"))
            .build();

        // When & Then
        StepVerifier.create(voteService.createVote(input, "user-123", "127.0.0.1"))
            .expectErrorMatches(e -> 
                e instanceof IllegalArgumentException && 
                e.getMessage().contains("All options must be unique")
            )
            .verify();
    }

    @Test
    void subscribeToVoteUpdates_shouldReceiveUpdates() {
        // Given
        var voteId = UUID.randomUUID();
        var vote = Vote.builder()
            .id(1L)
            .publicId(voteId)
            .creatorId("user-123")
            .title("Test Vote")
            .visibility(Vote.Visibility.PUBLIC)
            .votingSystem(Vote.VotingSystem.APPROVAL)
            .limitByIp(false)
            .shareToken("token")
            .createdAt(Instant.now())
            .build();

        // When
        var subscription = voteService.subscribeToVoteUpdates(voteId);
        voteService.publishVoteUpdate(vote);

        // Then
        StepVerifier.create(subscription.take(1))
            .assertNext(receivedVote -> {
                assertThat(receivedVote.publicId()).isEqualTo(voteId);
                assertThat(receivedVote.title()).isEqualTo("Test Vote");
            })
            .verifyComplete();
    }
}
