package org.zvote.server.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import org.zvote.server.ballots.TallyService;
import org.zvote.server.live.PollStream;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Folds what ballots changed into the tallies ({@link TallyService#fold}), on
 * a thread of its own, and tells the watchers of the polls concerned.
 *
 * A ballot's request asks for a fold once its ballot is committed, and waits
 * for it a little: with few ballots arriving, the answer then counts its own
 * ballot. With many, folds take whole batches one after the other, a request
 * stops waiting after a while, and its ballot shows in the next update, a
 * moment later. Every second, the thread also folds whatever is waiting, such
 * as the ballots of another server.
 */
@Component
class TallyFolding implements SmartLifecycle {

    private static final int BATCH = 10_000;
    private static final Duration IDLE = Duration.ofSeconds(1);
    private static final Logger log = LoggerFactory.getLogger(TallyFolding.class);

    private final TallyService tallies;
    private final PollStream stream;
    private final PollViewService views;
    private final Duration patience;

    private final ReentrantLock lock = new ReentrantLock();
    private final Condition asked = lock.newCondition();
    private final Condition answered = lock.newCondition();
    /** Folds asked for so far, and how many of them a finished fold covered. */
    private long requests;
    private long served;
    private volatile Thread folder;

    TallyFolding(TallyService tallies, PollStream stream, PollViewService views,
                 @Value("${zvote.fold-patience:250ms}") Duration patience) {
        this.tallies = tallies;
        this.stream = stream;
        this.views = views;
        this.patience = patience;
    }

    /** Asks for the ballots committed so far to be folded, and waits for it, {@code zvote.fold-patience} at most. */
    void fold() {
        fold(patience);
    }

    void fold(Duration wait) {
        lock.lock();
        try {
            long request = ++requests;
            asked.signal();
            long nanos = wait.toNanos();
            while (served < request && nanos > 0) {
                nanos = answered.awaitNanos(nanos);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            lock.unlock();
        }
    }

    private void run() {
        while (folder != null) {
            long request;
            lock.lock();
            try {
                if (requests == served) {
                    asked.await(IDLE.toMillis(), TimeUnit.MILLISECONDS);
                }
                request = requests;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } finally {
                lock.unlock();
            }
            foldWhatIsWaiting();
            lock.lock();
            try {
                served = request;
                answered.signalAll();
            } finally {
                lock.unlock();
            }
        }
    }

    private void foldWhatIsWaiting() {
        try {
            var polls = tallies.fold(BATCH);
            while (!polls.isEmpty()) {
                polls.forEach(pollId -> stream.changed(pollId, () -> views.update(pollId)));
                polls = tallies.fold(BATCH);
            }
        } catch (RuntimeException e) {
            // The changes stay where they are, for the next fold.
            log.warn("Could not fold ballots into the tallies", e);
        }
    }

    /** Below the web server's phase: it starts before requests come, and stops once they are over. */
    @Override
    public int getPhase() {
        return SmartLifecycle.DEFAULT_PHASE - 4096;
    }

    @Override
    public void start() {
        folder = Thread.ofVirtual().name("tally-folding").start(this::run);
    }

    /**
     * Lets the current fold finish rather than interrupting it: an interrupted
     * thread reading H2's file closes the whole database.
     */
    @Override
    public void stop() {
        var running = folder;
        folder = null;
        lock.lock();
        try {
            asked.signal();
        } finally {
            lock.unlock();
        }
        if (running != null) {
            try {
                running.join(Duration.ofSeconds(10));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public boolean isRunning() {
        return folder != null;
    }
}
