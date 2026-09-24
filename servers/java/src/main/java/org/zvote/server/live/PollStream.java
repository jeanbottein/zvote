package org.zvote.server.live;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
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
 * arrive in order and never interleave with heartbeats.
 *
 * Watchers live in this process's memory. A second server instance will need a
 * shared channel (PostgreSQL LISTEN/NOTIFY, Redis) to relay changes.
 */
@Component
public class PollStream {

    static final Duration COALESCING_WINDOW = Duration.ofMillis(200);

    /** Writing regularly is the only way to notice that a watcher went away. */
    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(20);

    /** Streams end after this and browsers reconnect, so dead ones cannot pile up. */
    private static final Duration STREAM_LIFETIME = Duration.ofMinutes(30);

    private static final Logger log = LoggerFactory.getLogger(PollStream.class);

    private final Map<Long, Audience> audiences = new ConcurrentHashMap<>();
    private final Map<Long, Supplier<?>> pending = new ConcurrentHashMap<>();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(
        Thread.ofPlatform().daemon().name("poll-stream-timer").factory());

    public PollStream() {
        var interval = HEARTBEAT_INTERVAL.toMillis();
        timer.scheduleAtFixedRate(() -> Thread.startVirtualThread(this::heartbeat),
            interval, interval, TimeUnit.MILLISECONDS);
    }

    /** Starts watching a poll. The first event is {@code current}, sent straight away. */
    public SseEmitter watch(Long pollId, Object current) {
        var emitter = new SseEmitter(STREAM_LIFETIME.toMillis());
        emitter.onTimeout(emitter::complete);
        emitter.onCompletion(() -> leave(pollId, emitter));
        emitter.onError(error -> leave(pollId, emitter));

        var audience = audiences.compute(pollId, (id, existing) -> {
            var joined = existing != null ? existing : new Audience();
            joined.emitters.add(emitter);
            return joined;
        });
        audience.write(List.of(emitter), () -> update(current));
        return emitter;
    }

    /**
     * Tells a poll's watchers that it changed. {@code latest} runs once, when
     * the coalescing window ends, to compute the update they receive.
     */
    public void changed(Long pollId, Supplier<?> latest) {
        if (audiences.containsKey(pollId) && pending.put(pollId, latest) == null) {
            timer.schedule(() -> Thread.startVirtualThread(() -> flush(pollId)),
                COALESCING_WINDOW.toMillis(), TimeUnit.MILLISECONDS);
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
        timer.shutdownNow();
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

    private void heartbeat() {
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
