package org.zvote.server.votingsystems.approvalvoting;

import com.netflix.graphql.dgs.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class ApprovalDataFetcher {

    private final ApprovalService approvalService;

    @DgsMutation
    public Mono<Boolean> setApprovals(
        @InputArgument String voteId,
        @InputArgument List<Long> optionIds,
        DgsDataFetchingEnvironment env
    ) {
        var voterId = getUserId(env);
        
        return approvalService.setApprovals(UUID.fromString(voteId), optionIds, voterId)
            .thenReturn(true)
            .onErrorResume(e -> {
                log.error("Error setting approvals", e);
                return Mono.just(false);
            });
    }

    @DgsMutation
    public Mono<Boolean> approve(
        @InputArgument String voteId,
        @InputArgument Long optionId,
        DgsDataFetchingEnvironment env
    ) {
        var voterId = getUserId(env);
        
        return approvalService.approve(UUID.fromString(voteId), optionId, voterId)
            .thenReturn(true)
            .onErrorResume(e -> {
                log.error("Error approving option", e);
                return Mono.just(false);
            });
    }

    @DgsMutation
    public Mono<Boolean> unapprove(
        @InputArgument String voteId,
        @InputArgument Long optionId,
        DgsDataFetchingEnvironment env
    ) {
        var voterId = getUserId(env);
        
        return approvalService.unapprove(UUID.fromString(voteId), optionId, voterId)
            .thenReturn(true)
            .onErrorResume(e -> {
                log.error("Error unapproving option", e);
                return Mono.just(false);
            });
    }

    private String getUserId(DgsDataFetchingEnvironment env) {
        // TODO: Extract from Spring Security context
        // For now, use a session-based ID
        return "user-" + System.currentTimeMillis();
    }
}
