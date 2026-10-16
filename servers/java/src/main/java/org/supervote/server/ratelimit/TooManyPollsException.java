package org.supervote.server.ratelimit;

import java.time.Duration;

/** A network created as many polls as it may in a day. */
public class TooManyPollsException extends RateLimitedException {

    TooManyPollsException(int pollsPerDay, Duration retryAfter) {
        super(pollsPerDay + " polls have already been created today from this connection. To be fair to everyone, "
            + "as super-vote's resources are limited, each connection can create " + pollsPerDay
            + " polls a day: you can create more in " + inWords(retryAfter) + ".", retryAfter);
    }
}
