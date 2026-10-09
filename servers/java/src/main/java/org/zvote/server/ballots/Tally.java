package org.zvote.server.ballots;

import java.util.List;

/**
 * A poll's tallies: how many ballots it has, and how many give each option
 * (by position) each choice.
 */
public record Tally(long ballots, List<List<Long>> counts) {

    /** Zero for an option or a choice the poll does not have, as while it is being deleted. */
    public long count(int position, int choice) {
        if (position >= counts.size() || choice >= counts.get(position).size()) {
            return 0;
        }
        return counts.get(position).get(choice);
    }
}
