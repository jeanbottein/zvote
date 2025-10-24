package org.zvote.server.votemanagement;

import com.netflix.graphql.dgs.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.reactivestreams.Publisher;
import org.zvote.server.votemanagement.dto.CreateVoteInput;
import org.zvote.server.votemanagement.dto.CreateVoteResult;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class VoteDataFetcher {

    private final VoteService voteService;

    @DgsQuery
    public Mono<Vote> vote(@InputArgument String id) {
        return voteService.findByPublicId(UUID.fromString(id));
    }

    @DgsQuery
    public Flux<Vote> publicVotes() {
        return voteService.findPublicVotes();
    }

    @DgsQuery
    public Flux<Vote> myVotes(DgsDataFetchingEnvironment env) {
        // TODO: Get actual user from security context
        var userId = getUserId(env);
        return voteService.findVotesByCreator(userId);
    }

    @DgsMutation
    public Mono<CreateVoteResult> createVote(@InputArgument CreateVoteInput input, DgsDataFetchingEnvironment env) {
        var userId = getUserId(env);
        var ipAddress = getClientIp(env);
        
        return voteService.createVote(input, userId, ipAddress)
            .map(vote -> CreateVoteResult.builder().vote(vote).build())
            .onErrorResume(e -> {
                log.error("Error creating vote", e);
                return Mono.just(CreateVoteResult.builder()
                    .error(e.getMessage())
                    .build());
            });
    }

    @DgsMutation
    public Mono<Boolean> deleteVote(@InputArgument String id, DgsDataFetchingEnvironment env) {
        var userId = getUserId(env);
        return voteService.deleteVote(UUID.fromString(id), userId);
    }

    @DgsSubscription
    public Publisher<Vote> voteUpdated(@InputArgument String id) {
        return voteService.subscribeToVoteUpdates(UUID.fromString(id));
    }

    @DgsSubscription
    public Publisher<Vote> publicVoteCreated() {
        return voteService.subscribeToPublicVotes();
    }

    @DgsData(parentType = "Vote", field = "options")
    public Flux<VoteOption> options(DgsDataFetchingEnvironment env) {
        Vote vote = env.getSource();
        return voteService.findOptionsByVoteId(vote.id());
    }

    private String getUserId(DgsDataFetchingEnvironment env) {
        // TODO: Extract from Spring Security context
        // For now, use a generated ID from session/connection
        return "anonymous-" + System.currentTimeMillis();
    }

    private String getClientIp(DgsDataFetchingEnvironment env) {
        // Extract IP from request context
        var request = env.getDgsContext().getRequestData();
        // This is where we CAN access IP (unlike SpacetimeDB!)
        return request != null ? "127.0.0.1" : "unknown";  // TODO: Extract real IP
    }
}
