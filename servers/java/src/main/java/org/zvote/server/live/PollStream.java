package org.zvote.server.live;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Live poll updates, over Server-Sent Events.
 *
 * One-way pushes are all a results view needs, and SSE provides them with no
 * handshake protocol and with automatic browser reconnection. Long-lived
 * streams are cheap because request threads are virtual.
 *
 * Changes are coalesced: however many ballots land in a burst, watchers get one
 * update per {@link #COALESCING_WINDOW}, computed once after the burst and sent
 * off the voter's request. A busy poll costs one read, and one write per
 * watcher, per window - not per ballot.
 *
 * Every write to a poll's watchers happens under that poll's lock, so updates
 * arrive in order and never interleave with heartbeats. Flushes and heartbeats
 * run on Spring Boot's task scheduler, on virtual threads.
 *
 * Watchers live in this process's memory. A second server instance will need a
 * shared channel (PostgreSQL LISTEN/NOTIFY, Redis) to relay changes.
 */
@Component
public class PollStream {

    static final Duration COALESCING_WINDOW = Duration.ofMillis(200);

    /** Streams end after this and browsers reconnect, so dead ones cannot pile up. */
    private static final Duration STREAM_LIFETIME = Duration.ofMinutes(30);

    private static final Logger log = LoggerFactory.getLogger(PollStream.class);

    private final Map<Long, Audience> audiences = new ConcurrentHashMap<>();
    private final Map<Long, Supplier<?>> pending = new ConcurrentHashMap<>();
    private final TaskScheduler scheduler;

    public PollStream(TaskScheduler scheduler) {
        this.scheduler = scheduler;
    }

    /** Starts watching a poll. The first event is what {@code current} computes, straight away. */
    public SseEmitter watch(Long pollId, Supplier<?> current) {
        var emitter = new SseEmitter(STREAM_LIFETIME.toMillis());
        emitter.onTimeout(emitter::complete);
        emitter.onCompletion(() -> leave(pollId, emitter));
        emitter.onError(error -> leave(pollId, emitter));
        join(pollId, emitter, current);
        return emitter;
    }

    /**
     * The current state is computed after the watcher joins, under the lock:
     * a change made while it is computed is flushed to the watcher next,
     * rather than lost because the watcher was not listening yet.
     */
    void join(Long pollId, SseEmitter emitter, Supplier<?> current) {
        var audience = audiences.compute(pollId, (id, existing) -> {
            var joined = existing != null ? existing : new Audience();
            joined.emitters.add(emitter);
            return joined;
        });
        audience.lock.lock();
        try {
            var state = current.get();
            audience.write(List.of(emitter), () -> update(state));
        } catch (RuntimeException e) {
            leave(pollId, emitter); // the poll went away meanwhile: no stream
            throw e;
        } finally {
            audience.lock.unlock();
        }
    }

    /**
     * Tells a poll's watchers that it changed. {@code latest} runs once, when
     * the coalescing window ends, to compute the update they receive.
     */
    public void changed(Long pollId, Supplier<?> latest) {
        if (audiences.containsKey(pollId) && pending.put(pollId, latest) == null) {
            scheduler.schedule(() -> flush(pollId), Instant.now().plus(COALESCING_WINDOW));
        }
    }

    /** Tells a poll's watchers that it no longer exists, and ends their streams. */
    public void deleted(Long pollId) {
        pending.remove(pollId);
        var audience = audiences.remove(pollId);
        if (audience != null) {
            audience.write(audience.emitters, () -> SseEmitter.event().name("deleted").data(Map.of()));
            audience.emitters.forEach(SseEmitter::complete);
        }
    }

    /**
     * Ends every stream as soon as the server starts shutting down. Graceful
     * shutdown waits for open requests, and a stream never finishes on its own.
     */
    @EventListener(ContextClosedEvent.class)
    public void close() {
        pending.clear();
        audiences.values().forEach(audience -> audience.emitters.forEach(SseEmitter::complete));
        audiences.clear();
    }

    private void flush(Long pollId) {
        var audience = audiences.get(pollId);
        if (audience == null) {
            pending.remove(pollId);
            return;
        }
        audience.lock.lock();
        try {
            // Taken under the lock, so a flush that waited for the previous one
            // picks up the latest change rather than an older one.
            var latest = pending.remove(pollId);
            if (latest != null) {
                var update = latest.get();
                audience.write(audience.emitters, () -> update(update));
            }
        } catch (RuntimeException e) {
            // Typically the poll was deleted in the meantime; deleted() has told everyone.
            log.debug("Could not refresh the watchers of poll {}", pollId, e);
        } finally {
            audience.lock.unlock();
        }
    }

    /** Writing regularly is the only way to notice that a watcher went away. */
    @Scheduled(fixedRate = 20, timeUnit = TimeUnit.SECONDS)
    void heartbeat() {
        audiences.values().forEach(audience ->
            audience.write(audience.emitters, () -> SseEmitter.event().comment("heartbeat")));
    }

    private void leave(Long pollId, SseEmitter emitter) {
        audiences.computeIfPresent(pollId, (id, audience) -> {
            audience.emitters.remove(emitter);
            return audience.emitters.isEmpty() ? null : audience;
        });
    }

    private static SseEmitter.SseEventBuilder update(Object data) {
        return SseEmitter.event().name("update").data(data);
    }

    /** The watchers of one poll. */
    private static final class Audience {

        private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();
        private final ReentrantLock lock = new ReentrantLock();

        /** An event builder can only be built once, hence one per watcher. */
        void write(Collection<SseEmitter> targets, Supplier<SseEmitter.SseEventBuilder> event) {
            lock.lock();
            try {
                for (var emitter : targets) {
                    try {
                        emitter.send(event.get());
                    } catch (IOException | IllegalStateException e) {
                        // The watcher went away; the container completes its request.
                        emitters.remove(emitter);
                    }
                }
            } finally {
                lock.unlock();
            }
        }
    }
}
