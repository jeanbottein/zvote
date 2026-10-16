package org.supervote.server.ratelimit;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What a limit remembers of the networks it has seen: of the most recently
 * seen 100,000 at most, so that a flood of addresses cannot fill the memory.
 * A network pushed out starts again from nothing, which gives a flood nothing
 * it did not have already. Not thread-safe: its owner holds the lock.
 */
final class RecentNetworks<V> extends LinkedHashMap<Network, V> {

    private static final int MOST = 100_000;

    RecentNetworks() {
        super(16, 0.75f, true);
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Network, V> eldest) {
        return size() > MOST;
    }
}
