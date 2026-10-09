package org.zvote.server.api;

import org.zvote.server.api.dto.Score;
import org.zvote.server.ballots.Mention;
import org.zvote.server.ballots.Tally;
import org.zvote.server.polls.Poll;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

/**
 * Which option wins, from the counts.
 *
 * Majority judgment ranks by the majority mention first - the best mention
 * more than half the voters give an option or better, which with an even
 * number of ballots is the lower of the two middle mentions (Balinski and
 * Laraki): five Excellent and five Bad make Bad, because only half the voters
 * say Excellent while all of them say Bad or better. Options sharing a
 * majority mention are separated by GMJ's Usual score, the fraction
 * (above - below) / at, compared exactly so that equal scores stay equal and
 * different ones stay apart. What is still tied is ex aequo: it shares a rank.
 *
 * Approval voting ranks by the number of approvals, equal counts sharing a
 * rank too, so that "the winner is rank 1" means the same in both systems.
 *
 * This is the one place the ranking is computed. The counts travel beside it,
 * so anyone can check it; the web client renders it rather than repeating it
 * (see docs/ARCHITECTURE.md).
 */
final class Ranking {

    private Ranking() {}

    /** The place of each option, in the poll's own order, never sorted. */
    static List<Place> of(Poll.VotingSystem system, Tally tally, int options) {
        var measures = new ArrayList<Measure>(options);
        for (var position = 0; position < options; position++) {
            measures.add(switch (system) {
                case APPROVAL -> new Measure(BallotFormat.approvals(tally, position), 0, 1, null);
                case MAJORITY_JUDGMENT -> judgment(tally, position);
            });
        }
        return placesOf(measures);
    }

    /** An option's place: 1 is the winner, and a rank shared is ex aequo. */
    record Place(int rank, String majorityMention, Score score) {}

    private static Measure judgment(Tally tally, int position) {
        var ballots = 0L;
        for (var mention : Mention.values()) {
            ballots += tally.count(position, mention.ordinal());
        }
        var majority = majorityMention(tally, position, ballots);
        if (ballots == 0) {
            return new Measure(majority.ordinal(), 0, 1, majority);
        }
        var above = 0L;
        var below = 0L;
        for (var mention : Mention.values()) {
            if (mention.ordinal() > majority.ordinal()) {
                above += tally.count(position, mention.ordinal());
            } else if (mention.ordinal() < majority.ordinal()) {
                below += tally.count(position, mention.ordinal());
            }
        }
        var at = tally.count(position, majority.ordinal());
        return new Measure(majority.ordinal(), above - below, at == 0 ? ballots : at, majority);
    }

    /** The best mention more than half the voters give this option or better. */
    private static Mention majorityMention(Tally tally, int position, long ballots) {
        if (ballots == 0) {
            return Mention.BAD;
        }
        var cumulative = 0L;
        for (var mention = Mention.values().length - 1; mention > 0; mention--) {
            cumulative += tally.count(position, mention);
            if (cumulative * 2 > ballots) {
                return Mention.values()[mention];
            }
        }
        return Mention.BAD;
    }

    private static List<Place> placesOf(List<Measure> measures) {
        var best = IntStream.range(0, measures.size())
            .boxed()
            .sorted(Comparator.comparing(measures::get, Ranking::compare)) // stable: a tie keeps the poll's order
            .toList();
        var places = new Place[measures.size()];
        var rank = 1;
        for (var i = 0; i < best.size(); i++) {
            var measure = measures.get(best.get(i));
            if (i > 0 && compare(measures.get(best.get(i - 1)), measure) != 0) {
                rank = i + 1; // three tied at 2 are followed by 5, never by 3
            }
            places[best.get(i)] = new Place(rank,
                measure.majorityMention() == null ? null : measure.majorityMention().wireName(),
                measure.majorityMention() == null ? null : new Score(measure.numerator(), measure.denominator()));
        }
        return List.of(places);  // every slot is filled above
    }

    /** Better first. Denominators are at least 1, so cross-multiplying keeps the order. */
    private static int compare(Measure a, Measure b) {
        if (a.better() != b.better()) {
            return Long.compare(b.better(), a.better());
        }
        return BigInteger.valueOf(b.numerator()).multiply(BigInteger.valueOf(a.denominator()))
            .compareTo(BigInteger.valueOf(a.numerator()).multiply(BigInteger.valueOf(b.denominator())));
    }

    /**
     * What ranking compares: what comes first (a majority mention, or a number
     * of approvals), then the score that separates equals.
     */
    private record Measure(long better, long numerator, long denominator, Mention majorityMention) {}
}
