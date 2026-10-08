package org.zvote.server.api;

import org.zvote.server.ballots.Mention;
import org.zvote.server.ballots.Tally;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollOption;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

/**
 * What a ballot's bytes mean. The ballots module stores and counts them
 * without reading them: one byte per option, in the options' order. For
 * majority judgment, the option's mention, by rank (Bad is 0); for approval,
 * 1 if the option is approved, 0 if not.
 */
final class BallotFormat {

    private static final byte APPROVED = 1;

    private BallotFormat() {}

    /** How many different bytes an option can get: the counters its tallies need. */
    static int choices(Poll.VotingSystem votingSystem) {
        return switch (votingSystem) {
            case APPROVAL -> 2;
            case MAJORITY_JUDGMENT -> Mention.values().length;
        };
    }

    static byte[] encodeApprovals(Set<Long> approvedOptionIds, List<PollOption> options) {
        var choices = new byte[options.size()];
        for (int position = 0; position < choices.length; position++) {
            choices[position] = approvedOptionIds.contains(options.get(position).id()) ? APPROVED : 0;
        }
        return choices;
    }

    /**
     * Options left ungraded get Bad, the majority judgment convention for "no
     * opinion", so that every ballot grades every option and the medians of
     * different options stay comparable.
     */
    static byte[] encodeJudgments(Map<Long, Mention> mentions, List<PollOption> options) {
        var choices = new byte[options.size()];
        for (int position = 0; position < choices.length; position++) {
            choices[position] = (byte) mentions.getOrDefault(options.get(position).id(), Mention.BAD).ordinal();
        }
        return choices;
    }

    static List<String> decodeApprovals(byte[] choices, List<PollOption> options) {
        return IntStream.range(0, options.size())
            .filter(position -> choices[position] == APPROVED)
            .mapToObj(position -> idOf(options.get(position)))
            .toList();
    }

    /** Option id to mention. */
    static Map<String, String> decodeJudgments(byte[] choices, List<PollOption> options) {
        var judgments = new LinkedHashMap<String, String>();
        for (int position = 0; position < options.size(); position++) {
            judgments.put(idOf(options.get(position)), Mention.values()[choices[position]].wireName());
        }
        return judgments;
    }

    static long approvals(Tally tally, int position) {
        return tally.count(position, APPROVED);
    }

    /** Worst mention first. */
    static Map<String, Long> judgmentCounts(Tally tally, int position) {
        var counts = new LinkedHashMap<String, Long>();
        for (var mention : Mention.values()) {
            counts.put(mention.wireName(), tally.count(position, mention.ordinal()));
        }
        return counts;
    }

    static String idOf(PollOption option) {
        return String.valueOf(option.id());
    }
}
