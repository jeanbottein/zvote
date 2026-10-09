package org.zvote.server.api;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.api.dto.PollUpdate;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.api.dto.UpdatePollRequest;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.idempotency.IdempotencyService;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.live.PollStream;
import org.zvote.server.polls.CreatePollRequest;
import org.zvote.server.polls.PollService;

import java.net.URI;
import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/polls")
public class PollController {

    /** Where the token that hands a poll over travels, never in a URL a log would keep. */
    static final String HANDOVER = "Zvote-Handover";

    private final PollService polls;
    private final PollCreationService creations;
    private final PollChangeService changes;
    private final PollViewService views;
    private final PollStream stream;
    private final IdempotencyService idempotency;

    PollController(PollService polls, PollCreationService creations, PollChangeService changes,
                   PollViewService views, PollStream stream, IdempotencyService idempotency) {
        this.polls = polls;
        this.creations = creations;
        this.changes = changes;
        this.views = views;
        this.stream = stream;
        this.idempotency = idempotency;
    }

    @GetMapping
    public List<PollSummary> listPublic(@RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return polls.listPublic().stream().map(poll -> views.summary(poll, voter)).toList();
    }

    @GetMapping("/mine")
    public List<PollSummary> listMine(@RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return polls.listCreatedBy(voter.id()).stream().map(poll -> views.summary(poll, voter)).toList();
    }

    /**
     * A client that may have to retry - an agent whose request timed out -
     * sends an Idempotency-Key, and a second attempt answers the poll the
     * first one made instead of making another.
     */
    @PostMapping
    public ResponseEntity<PollView> create(@RequestBody CreatePollRequest request,
                                           @RequestHeader(name = IdempotencyService.HEADER, required = false) String key,
                                           @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        var shareToken = idempotency.once(voter.id(), key, () -> creations.create(request, voter.id()).shareToken());
        var poll = polls.find(shareToken);
        return ResponseEntity.created(URI.create("/api/polls/" + shareToken))
            .body(views.view(poll, voter, null, polls.handoverTokenOf(poll, voter.id()).orElse(null)));
    }

    @GetMapping("/{id}")
    public PollView get(@PathVariable String id,
                        @RequestHeader(name = InvitationController.HEADER, required = false) String invitation,
                        @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return views.view(polls.find(id), voter, invitation);
    }

    @PatchMapping("/{id}")
    public PollView update(@PathVariable String id,
                           @RequestBody UpdatePollRequest request,
                           @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        if (!Boolean.TRUE.equals(request.closed())) {
            throw new InvalidRequestException("A poll can only be closed, for good: send {\"closed\": true}.");
        }
        return views.view(changes.close(id, voter.id()), voter, null);
    }

    /**
     * Makes the caller the poll's creator, with the token its creation
     * answered: the client that made the poll for somebody sends them this
     * link, and from then on the poll is theirs to close, to delete, and whose
     * invitations are theirs to read. The token works once.
     */
    @PostMapping("/{id}/creator")
    public PollView handOver(@PathVariable String id,
                             @RequestHeader(name = HANDOVER) String handover,
                             @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return views.view(polls.handOver(id, handover, voter.id()), voter, null);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id,
                                       @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        changes.delete(id, voter.id());
        return ResponseEntity.noContent().build();
    }

    /**
     * A poll's results, the same for everyone: what a watcher receives, for a
     * client that asks instead. Cacheable for a second, so a crowd of readers
     * costs one read (docs/ROADMAP.md, "Results for millions of watchers").
     */
    @GetMapping("/{id}/results")
    public ResponseEntity<PollUpdate> results(@PathVariable String id) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofSeconds(1)))
            .body(views.results(id));
    }

    /**
     * Live updates for one poll. The first event is the current state, so a
     * client that reconnects is up to date at once rather than at the next ballot.
     */
    @GetMapping(path = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @RegisterReflectionForBinding(PollUpdate.class) // what the stream carries: a native image must know it
    public SseEmitter events(@PathVariable String id, HttpServletResponse response) {
        var poll = polls.find(id);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader("X-Accel-Buffering", "no"); // reverse proxies: stream, do not buffer
        return stream.watch(poll.id(), () -> views.update(poll.id()));
    }
}
