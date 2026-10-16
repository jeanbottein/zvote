package org.supervote.server.ratelimit;

import java.time.Duration;

/** A network tried too many join codes that lead to no poll, and is refused codes for a while. */
public class TooManyWrongCodesException extends RateLimitedException {

    TooManyWrongCodesException(Duration retryAfter) {
        super("Too many wrong codes were tried from this connection. To keep polls safe from guessing, codes "
            + "from it are refused for the next " + inWords(retryAfter) + ", but links to polls still work.",
            retryAfter);
    }
}
