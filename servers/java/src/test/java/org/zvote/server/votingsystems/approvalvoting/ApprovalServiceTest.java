package org.zvote.server.votingsystems.approvalvoting;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.zvote.server.votemanagement.Vote;
import org.zvote.server.votemanagement.VoteOption;
import org.zvote.server.votemanagement.VoteOptionRepository;
import org.zvote.server.votemanagement.VoteRepository;
import org.zvote.server.votemanagement.VoteService;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ApprovalService Tests")
class ApprovalServiceTest {

    @Mock
    private ApprovalRepository approvalRepository;

    @Mock
    private VoteRepository voteRepository;

    @Mock
    private VoteOptionRepository voteOptionRepository;

    @Mock
    private VoteService voteService;

    private ApprovalService approvalService;

    private Vote testVote;
    private List<VoteOption> testOptions;
    private UUID voteId;

    @BeforeEach
    void setUp() {
        approvalService = new ApprovalService(
            approvalRepository,
            voteRepository,
            voteOptionRepository,
            voteService
        );

        voteId = UUID.randomUUID();
        testVote = Vote.builder()
            .id(1L)
            .publicId(voteId)
            .creatorId("creator-123")
            .title("Test Vote")
            .visibility(Vote.Visibility.PUBLIC)
            .votingSystem(Vote.VotingSystem.APPROVAL)
            .limitByIp(false)
            .shareToken("token")
            .createdAt(Instant.now())
            .build();

        testOptions = List.of(
            VoteOption.builder().id(10L).voteId(1L).label("Option A").orderIndex(0).approvalsCount(0).build(),
            VoteOption.builder().id(11L).voteId(1L).label("Option B").orderIndex(1).approvalsCount(0).build(),
            VoteOption.builder().id(12L).voteId(1L).label("Option C").orderIndex(2).approvalsCount(0).build()
        );
    }

    @Test
    @DisplayName("Should approve a single option successfully")
    void approve_ShouldSucceed() {
        // Given
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(voteOptionRepository.findById(10L)).thenReturn(Mono.just(testOptions.get(0)));
        when(approvalRepository.existsByVoterIdAndOptionId("voter-1", 10L)).thenReturn(Mono.just(false));
        when(approvalRepository.save(any(Approval.class))).thenReturn(Mono.just(
            Approval.builder().id(1L).voteId(1L).optionId(10L).voterId("voter-1").createdAt(Instant.now()).build()
        ));
        when(voteOptionRepository.save(any(VoteOption.class))).thenReturn(Mono.just(testOptions.get(0).withApprovalsCount(1)));
        when(voteService.publishVoteUpdate(any(Vote.class))).thenReturn(Mono.empty());

        // When & Then
        StepVerifier.create(approvalService.approve(voteId, 10L, "voter-1"))
            .verifyComplete();

        verify(approvalRepository).save(any(Approval.class));
        verify(voteOptionRepository).save(argThat(opt -> opt.approvalsCount() == 1));
    }

    @Test
    @DisplayName("Should not create duplicate approval for same option")
    void approve_AlreadyApproved_ShouldDoNothing() {
        // Given
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(voteOptionRepository.findById(10L)).thenReturn(Mono.just(testOptions.get(0)));
        when(approvalRepository.existsByVoterIdAndOptionId("voter-1", 10L)).thenReturn(Mono.just(true));

        // When & Then
        StepVerifier.create(approvalService.approve(voteId, 10L, "voter-1"))
            .verifyComplete();

        verify(approvalRepository, never()).save(any());
        verify(voteOptionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should reject approval for non-approval vote")
    void approve_WrongVotingSystem_ShouldFail() {
        // Given
        var mjVote = testVote.withVotingSystem(Vote.VotingSystem.MAJORITY_JUDGMENT);
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(mjVote));
        when(voteOptionRepository.findById(anyLong())).thenReturn(Mono.just(testOptions.get(0)));
        when(approvalRepository.existsByVoterIdAndOptionId(anyString(), anyLong())).thenReturn(Mono.just(false));

        // When & Then
        StepVerifier.create(approvalService.approve(voteId, 10L, "voter-1"))
            .expectErrorMatches(e ->
                e instanceof IllegalArgumentException &&
                e.getMessage().contains("does not use approval voting")
            )
            .verify();
    }

    @Test
    @DisplayName("Should reject approval for option from different vote")
    void approve_WrongVote_ShouldFail() {
        // Given
        var wrongOption = testOptions.get(0).withVoteId(999L);
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(voteOptionRepository.findById(10L)).thenReturn(Mono.just(wrongOption));
        when(approvalRepository.existsByVoterIdAndOptionId(anyString(), anyLong())).thenReturn(Mono.just(false));

        // When & Then
        StepVerifier.create(approvalService.approve(voteId, 10L, "voter-1"))
            .expectErrorMatches(e ->
                e instanceof IllegalArgumentException &&
                e.getMessage().contains("does not belong to this vote")
            )
            .verify();
    }

    @Test
    @DisplayName("Should unapprove option and decrement count")
    void unapprove_ShouldSucceed() {
        // Given
        var optionWithCount = testOptions.get(0).withApprovalsCount(5);
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.deleteByVoterIdAndOptionId("voter-1", 10L)).thenReturn(Mono.empty());
        when(voteOptionRepository.findById(10L)).thenReturn(Mono.just(optionWithCount));
        when(voteOptionRepository.save(any(VoteOption.class))).thenReturn(Mono.just(optionWithCount.withApprovalsCount(4)));
        when(voteService.publishVoteUpdate(any(Vote.class))).thenReturn(Mono.empty());

        // When & Then
        StepVerifier.create(approvalService.unapprove(voteId, 10L, "voter-1"))
            .verifyComplete();

        verify(approvalRepository).deleteByVoterIdAndOptionId("voter-1", 10L);
        verify(voteOptionRepository).save(argThat(opt -> opt.approvalsCount() == 4));
    }

    @Test
    @DisplayName("Should not allow negative approval counts")
    void unapprove_CountAtZero_ShouldStayAtZero() {
        // Given
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.deleteByVoterIdAndOptionId("voter-1", 10L)).thenReturn(Mono.empty());
        when(voteOptionRepository.findById(10L)).thenReturn(Mono.just(testOptions.get(0))); // count = 0
        when(voteOptionRepository.save(any(VoteOption.class))).thenReturn(Mono.just(testOptions.get(0)));
        when(voteService.publishVoteUpdate(any(Vote.class))).thenReturn(Mono.empty());

        // When & Then
        StepVerifier.create(approvalService.unapprove(voteId, 10L, "voter-1"))
            .verifyComplete();

        verify(voteOptionRepository).save(argThat(opt -> opt.approvalsCount() == 0));
    }

    @Test
    @DisplayName("Should set complete approval ballot")
    void setApprovals_ShouldReplaceExistingApprovals() {
        // Given
        var currentApprovals = List.of(
            Approval.builder().id(1L).voteId(1L).optionId(10L).voterId("voter-1").createdAt(Instant.now()).build()
        );
        
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(voteOptionRepository.findByVoteIdOrderByOrderIndex(1L)).thenReturn(Flux.fromIterable(testOptions));
        when(approvalRepository.findByVoteIdAndVoterId(1L, "voter-1"))
            .thenReturn(Flux.fromIterable(currentApprovals));
        when(approvalRepository.deleteByVoterIdAndOptionId(anyString(), anyLong())).thenReturn(Mono.empty());
        when(voteOptionRepository.findById(anyLong()))
            .thenAnswer(inv -> {
                Long id = inv.getArgument(0);
                return Mono.just(testOptions.stream()
                    .filter(opt -> opt.id().equals(id))
                    .findFirst()
                    .orElseThrow());
            });
        when(voteOptionRepository.save(any(VoteOption.class)))
            .thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(approvalRepository.saveAll((Iterable<Approval>) any()))
            .thenAnswer(inv -> Flux.fromIterable(inv.getArgument(0)));
        when(voteService.publishVoteUpdate(any(Vote.class))).thenReturn(Mono.empty());

        // When: Change from [10] to [11, 12]
        StepVerifier.create(approvalService.setApprovals(voteId, List.of(11L, 12L), "voter-1"))
            .verifyComplete();

        // Then: Should delete 10, add 11 and 12
        verify(approvalRepository).deleteByVoterIdAndOptionId("voter-1", 10L);
        verify(approvalRepository).saveAll((Iterable<Approval>) argThat(list -> {
            var approvals = (List<Approval>) list;
            return approvals.size() == 2 && 
                approvals.stream().anyMatch(a -> a.optionId().equals(11L)) &&
                approvals.stream().anyMatch(a -> a.optionId().equals(12L));
        }));
    }

    @Test
    @DisplayName("Should allow empty ballot (withdraw all approvals)")
    void setApprovals_EmptyList_ShouldWithdrawAll() {
        // Given
        var currentApprovals = List.of(
            Approval.builder().id(1L).voteId(1L).optionId(10L).voterId("voter-1").createdAt(Instant.now()).build(),
            Approval.builder().id(2L).voteId(1L).optionId(11L).voterId("voter-1").createdAt(Instant.now()).build()
        );
        
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.findByVoteIdAndVoterId(1L, "voter-1"))
            .thenReturn(Flux.fromIterable(currentApprovals));
        when(approvalRepository.deleteByVoterIdAndOptionId(anyString(), anyLong())).thenReturn(Mono.empty());
        when(voteOptionRepository.findById(anyLong()))
            .thenAnswer(inv -> {
                Long id = inv.getArgument(0);
                return Mono.just(testOptions.stream()
                    .filter(opt -> opt.id().equals(id))
                    .findFirst()
                    .orElseThrow());
            });
        when(voteOptionRepository.save(any(VoteOption.class)))
            .thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(voteService.publishVoteUpdate(any(Vote.class))).thenReturn(Mono.empty());

        // When
        StepVerifier.create(approvalService.setApprovals(voteId, List.of(), "voter-1"))
            .verifyComplete();

        // Then: Should remove all approvals
        verify(approvalRepository).deleteByVoterIdAndOptionId("voter-1", 10L);
        verify(approvalRepository).deleteByVoterIdAndOptionId("voter-1", 11L);
        verify(approvalRepository, never()).saveAll(anyIterable());
    }

    @Test
    @DisplayName("Should reject more than 20 approvals")
    void setApprovals_TooManyOptions_ShouldFail() {
        // Given
        var tooManyOptions = new java.util.ArrayList<Long>();
        for (long i = 1; i <= 21; i++) {
            tooManyOptions.add(i);
        }
        
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.findByVoteIdAndVoterId(anyLong(), anyString())).thenReturn(Flux.empty());

        // When & Then
        StepVerifier.create(approvalService.setApprovals(voteId, tooManyOptions, "voter-1"))
            .expectErrorMatches(e ->
                e instanceof IllegalArgumentException &&
                e.getMessage().contains("Cannot approve more than 20 options")
            )
            .verify();
    }

    @Test
    @DisplayName("Should reject invalid option IDs")
    void setApprovals_InvalidOptions_ShouldFail() {
        // Given
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.findByVoteIdAndVoterId(anyLong(), anyString())).thenReturn(Flux.empty());
        when(voteOptionRepository.findByVoteIdOrderByOrderIndex(1L))
            .thenReturn(Flux.fromIterable(testOptions));

        // When: Try to approve option 999 which doesn't exist
        StepVerifier.create(approvalService.setApprovals(voteId, List.of(10L, 999L), "voter-1"))
            .expectErrorMatches(e ->
                e instanceof IllegalArgumentException &&
                e.getMessage().contains("do not belong to this vote")
            )
            .verify();
    }

    @Test
    @DisplayName("Should get voter's current approvals")
    void getVoterApprovals_ShouldReturnApprovals() {
        // Given
        var approvals = List.of(
            Approval.builder().id(1L).voteId(1L).optionId(10L).voterId("voter-1").createdAt(Instant.now()).build(),
            Approval.builder().id(2L).voteId(1L).optionId(11L).voterId("voter-1").createdAt(Instant.now()).build()
        );
        
        when(voteRepository.findByPublicId(voteId)).thenReturn(Mono.just(testVote));
        when(approvalRepository.findByVoteIdAndVoterId(1L, "voter-1"))
            .thenReturn(Flux.fromIterable(approvals));

        // When & Then
        StepVerifier.create(approvalService.getVoterApprovals(voteId, "voter-1"))
            .expectNextCount(2)
            .verifyComplete();
    }
}
