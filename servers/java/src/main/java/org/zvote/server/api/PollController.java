package org.zvote.server.api;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.api.dto.PollUpdate;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.api.dto.UpdatePollRequest;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.identity.Voter;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.live.PollStream;
import org.zvote.server.polls.PollService;
import org.zvote.server.polls.CreatePollRequest;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/polls")
public class PollController {

    private final PollService polls;
    private final PollViewService views;
    private final PollStream stream;

    public PollController(PollService polls, PollViewService views, PollStream stream) {
        this.polls = polls;
        this.views = views;
        this.stream = stream;
    }

    @GetMapping
    public List<PollSummary> listPublic(@RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return polls.listPublic().stream().map(poll -> views.summary(poll, voter)).toList();
    }

    @GetMapping("/mine")
    public List<PollSummary> listMine(@RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return polls.listCreatedBy(voter.id()).stream().map(poll -> views.summary(poll, voter)).toList();
    }

    @PostMapping
    public ResponseEntity<PollView> create(@RequestBody CreatePollRequest request,
                                           @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        var poll = polls.create(request, voter.id());
        return ResponseEntity.created(URI.create("/api/polls/" + poll.shareToken()))
            .body(views.view(poll, voter));
    }

    @GetMapping("/{id}")
    public PollView get(@PathVariable String id,
                        @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        return views.view(polls.find(id), voter);
    }

    @PatchMapping("/{id}")
    public PollView update(@PathVariable String id,
                           @RequestBody UpdatePollRequest request,
                           @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        if (request.closed() == null) {
            throw new InvalidRequestException("Say whether the poll should be closed: {\"closed\": true}.");
        }
        var poll = polls.setClosed(id, voter.id(), request.closed());
        stream.changed(poll.id(), () -> views.update(poll.id()));
        return views.view(poll, voter);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id,
                                       @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter) {
        stream.deleted(polls.delete(id, voter.id()).id());
        return ResponseEntity.noContent().build();
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
