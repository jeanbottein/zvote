package org.supervote.server.ratelimit;

import java.time.Duration;

/** A network did more than its share. The message is for people; retryAfter is when it may try again. */
public abstract class RateLimitedException extends RuntimeException {

    private final Duration retryAfter;

    RateLimitedException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration retryAfter() {
        return retryAfter;
    }

    /** "5 hours", "1 minute": rounded up, so that trying again then works. */
    static String inWords(Duration wait) {
        var minutes = Math.max(1, Math.ceilDiv(wait.toSeconds(), 60));
        if (minutes < 60) {
            return minutes == 1 ? "1 minute" : minutes + " minutes";
        }
        var hours = Math.ceilDiv(minutes, 60);
        return hours == 1 ? "1 hour" : hours + " hours";
    }
}
