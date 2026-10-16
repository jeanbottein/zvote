package org.supervote.server.ratelimit;

import java.time.Duration;

/**
 * What a network may still do: {@code remaining} of the {@code limit} it gets
 * every {@code window}, until its window ends, in {@code resetsIn}.
 */
public record Allowance(int limit, Duration window, int remaining, Duration resetsIn) {}
