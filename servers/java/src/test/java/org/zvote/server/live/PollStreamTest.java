package org.zvote.server.live;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rules of the live stream, without a server: who receives what, in which
 * order. PollEventsTest covers the same stream over a real socket.
 */
class PollStreamTest {

    static final Long POLL = 1L;
    static final Long OTHER_POLL = 2L;

    final SimpleAsyncTaskScheduler scheduler = new SimpleAsyncTaskScheduler(); // what Spring Boot provides
    final PollStream stream = new PollStream(scheduler);

    @AfterEach
    void shutDown() {
        stream.close();
        scheduler.close();
    }

    @Test
    void theFirstEventIsTheCurrentState() throws Exception {
        var watcher = new Watcher();

        stream.join(POLL, watcher, () -> "state 1");

        assertThat(watcher.next()).isEqualTo(update("state 1"));
    }

    @Test
    void aChangeMadeWhileTheCurrentStateIsReadStillReachesTheNewWatcher() throws Exception {
        var watcher = new Watcher();

        stream.join(POLL, watcher, () -> {
            stream.changed(POLL, () -> "state 2"); // a ballot lands meanwhile
            return "state 1";
        });

        assertThat(watcher.next()).isEqualTo(update("state 1"));
        assertThat(watcher.next()).isEqualTo(update("state 2"));
    }

    @Test
    void aBurstOfChangesIsOneUpdateWithTheLatestState() throws Exception {
        var watcher = joined(POLL);

        for (var ballot = 2; ballot <= 10; ballot++) {
            var state = "state " + ballot;
            stream.changed(POLL, () -> state);
        }

        assertThat(watcher.next()).isEqualTo(update("state 10"));
        watcher.receivesNothingMore();
    }

    @Test
    void everyWatcherOfThePollIsUpdatedAndNobodyElse() throws Exception {
        var alice = joined(POLL);
        var bob = joined(POLL);
        var carol = joined(OTHER_POLL);

        stream.changed(POLL, () -> "state 2");

        assertThat(alice.next()).isEqualTo(update("state 2"));
        assertThat(bob.next()).isEqualTo(update("state 2"));
        carol.receivesNothingMore();
    }

    @Test
    void aWatcherThatWentAwayIsDropped() throws Exception {
        var gone = new GoneWatcher();
        stream.join(POLL, gone, () -> "state 1");
        var watcher = joined(POLL);

        stream.changed(POLL, () -> "state 2");

        assertThat(watcher.next()).isEqualTo(update("state 2"));
        assertThat(gone.attempts).isEqualTo(1);
    }

    @Test
    void aWatcherWhosePollVanishesMeanwhileIsNotKept() throws Exception {
        var watcher = new Watcher();

        assertThatThrownBy(() -> stream.join(POLL, watcher, () -> {
            throw new IllegalArgumentException("No such poll");
        })).hasMessage("No such poll");
        stream.changed(POLL, () -> "state 2");

        watcher.receivesNothingMore();
    }

    @Test
    void anUpdateThatCannotBeComputedIsSkipped() throws Exception {
        var watcher = joined(POLL);

        stream.changed(POLL, () -> {
            throw new IllegalStateException("The database is busy");
        });
        watcher.receivesNothingMore();
        stream.changed(POLL, () -> "state 3");

        assertThat(watcher.next()).isEqualTo(update("state 3"));
    }

    @Test
    void deletingThePollTellsItsWatchersAndEndsTheirStreams() throws Exception {
        var watcher = joined(POLL);
        stream.changed(POLL, () -> "state 2");

        stream.deleted(POLL);

        assertThat(watcher.next()).isEqualTo("event:deleted\ndata:{}\n\n");
        assertThat(watcher.ended).isTrue();
        watcher.receivesNothingMore(); // the pending update is dropped
    }

    @Test
    void theHeartbeatReachesEveryWatcher() throws Exception {
        var alice = joined(POLL);
        var carol = joined(OTHER_POLL);

        stream.heartbeat();

        assertThat(alice.next()).isEqualTo(":heartbeat\n\n");
        assertThat(carol.next()).isEqualTo(":heartbeat\n\n");
    }

    @Test
    void shuttingDownEndsEveryStream() throws Exception {
        var alice = joined(POLL);
        var carol = joined(OTHER_POLL);

        stream.close();

        assertThat(alice.ended).isTrue();
        assertThat(carol.ended).isTrue();
    }

    // --- helpers --------------------------------------------------------------

    /** A watcher that has joined and read the first event. */
    Watcher joined(Long pollId) throws InterruptedException {
        var watcher = new Watcher();
        stream.join(pollId, watcher, () -> "state 1");
        watcher.next();
        return watcher;
    }

    static String update(String state) {
        return "event:update\ndata:" + state + "\n\n";
    }

    /** Keeps each event as the browser reads it. */
    static class Watcher extends SseEmitter {

        final BlockingQueue<String> received = new LinkedBlockingQueue<>();
        volatile boolean ended;

        @Override
        public void send(SseEventBuilder event) throws IOException {
            received.add(event.build().stream()
                .map(part -> String.valueOf(part.getData()))
                .collect(Collectors.joining()));
        }

        @Override
        public void complete() {
            ended = true;
        }

        String next() throws InterruptedException {
            var event = received.poll(2, TimeUnit.SECONDS);
            assertThat(event).as("an event within 2 seconds").isNotNull();
            return event;
        }

        void receivesNothingMore() throws InterruptedException {
            var window = PollStream.COALESCING_WINDOW.toMillis();
            assertThat(received.poll(3 * window, TimeUnit.MILLISECONDS)).isNull();
        }
    }

    /** A watcher whose connection broke. */
    static class GoneWatcher extends Watcher {

        int attempts;

        @Override
        public void send(SseEventBuilder event) throws IOException {
            attempts++;
            throw new IOException("Broken pipe");
        }
    }
}
