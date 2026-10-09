package org.zvote.server.api;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.zvote.server.api.dto.Score;
import org.zvote.server.ballots.Tally;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.zvote.server.polls.Poll.VotingSystem.APPROVAL;
import static org.zvote.server.polls.Poll.VotingSystem.MAJORITY_JUDGMENT;

/**
 * Graduated majority judgment: the majority mention, the GMJ Usual score and
 * the ranking they produce.
 *
 * This is the owner's reference for how results are ranked (see CLAUDE.md).
 * It was the web client's, in majorityJudgment.test.ts, and moved here with
 * the code it tests: the ranking is computed once, on the server, and the
 * client renders it.
 */
class RankingTest {

    @Nested
    class TheMajorityMention {

        /** The best mention more than half the voters give the option or better. */
        @Test
        void isTheMiddleOfTheBallots() {
            assertThat(mentionOf(counts(1, 1, 1, 1, 2, 2, 2))).isEqualTo("Good");
            assertThat(mentionOf(counts(0, 0, 0, 0, 0, 0, 10))).isEqualTo("Excellent");
            assertThat(mentionOf(counts(0, 0, 0, 0, 1, 0, 0))).isEqualTo("Good");
            assertThat(mentionOf(counts(0, 0, 0, 0, 0, 10, 0))).isEqualTo("VeryGood");
            assertThat(mentionOf(counts(1, 1, 1, 1, 1, 1, 1))).isEqualTo("Fair");
        }

        @Test
        void isBadWhenNobodyHasVoted() {
            assertThat(mentionOf(counts(0, 0, 0, 0, 0, 0, 0))).isEqualTo("Bad");
            assertThat(scoreOf(counts(0, 0, 0, 0, 0, 0, 0))).isEqualTo(new Score(0, 1));
        }

        /**
         * With an even number of ballots it is the lower of the two middle
         * mentions, as majority judgment defines it.
         */
        @Test
        void isTheLowerOfTheTwoMiddleMentions() {
            assertThat(mentionOf(counts(1, 0, 0, 0, 0, 0, 1))).isEqualTo("Bad");
            assertThat(mentionOf(counts(0, 0, 0, 2, 2, 0, 0))).isEqualTo("Fair");
            assertThat(mentionOf(counts(0, 0, 3, 0, 0, 3, 0))).isEqualTo("Passable");
        }

        /** More than half the voters, not half of them. */
        @Test
        void needsAMajorityNotJustHalf() {
            // 5 of 10 say VeryGood or better (half); 6 of 10 say Good or better (a majority).
            assertThat(mentionOf(counts(0, 0, 0, 4, 1, 3, 2))).isEqualTo("Good");
            // Half say Excellent, which is not a majority; all of them say Bad or better.
            assertThat(mentionOf(counts(5, 0, 0, 0, 0, 0, 5))).isEqualTo("Bad");
        }

        @Test
        void isUnchangedForAnOddNumberOfBallots() {
            assertThat(mentionOf(counts(1, 0, 0, 0, 1, 0, 1))).isEqualTo("Good");
            assertThat(mentionOf(counts(1, 0, 0, 0, 0, 0, 2))).isEqualTo("Excellent");
        }

        /** It counts the ballots itself, so a fold landing between the two cannot skew it. */
        @Test
        void comesFromTheCountsNotFromTheBallotCount() {
            var places = Ranking.of(MAJORITY_JUDGMENT, new Tally(0, List.of(counts(1, 1, 1, 1, 2, 2, 2))), 1);

            assertThat(places.getFirst().majorityMention()).isEqualTo("Good");
        }
    }

    @Nested
    class TheScore {

        /** (above - below) / at, as a fraction: it is never divided to compare. */
        @Test
        void isWhatSeparatesEqualMajorityMentions() {
            assertThat(scoreOf(counts(1, 1, 1, 1, 2, 2, 2))).isEqualTo(new Score(0, 2));
            assertThat(scoreOf(counts(0, 0, 0, 0, 0, 0, 10))).isEqualTo(new Score(0, 10));
            assertThat(scoreOf(counts(0, 0, 0, 0, 1, 0, 0))).isEqualTo(new Score(0, 1));
        }

        @Test
        void isZeroWithAsManyBallotsAboveAsBelow() {
            assertThat(mentionOf(counts(1, 1, 1, 4, 1, 1, 1))).isEqualTo("Fair");
            assertThat(scoreOf(counts(1, 1, 1, 4, 1, 1, 1))).isEqualTo(new Score(0, 4));

            assertThat(mentionOf(counts(2, 1, 1, 2, 0, 1, 3))).isEqualTo("Fair");
            assertThat(scoreOf(counts(2, 1, 1, 2, 0, 1, 3))).isEqualTo(new Score(0, 2));
        }

        @Test
        void isNegativeWithMoreBallotsBelow() {
            assertThat(mentionOf(counts(2, 1, 1, 3, 1, 1, 1))).isEqualTo("Fair");
            assertThat(scoreOf(counts(2, 1, 1, 3, 1, 1, 1)).numerator()).isNegative();
        }

        /**
         * The majority mention always has ballots at it, so the fraction's
         * denominator is never zero. The closest case is half Excellent, half
         * Bad: the majority mention is Bad, with half the ballots at it.
         */
        @Test
        void staysFiniteForPolarisedBallots() {
            assertThat(scoreOf(counts(5, 0, 0, 0, 0, 0, 5))).isEqualTo(new Score(5, 5));
        }
    }

    @Nested
    class Ranks {

        @Test
        void putTheBestMajorityMentionFirst() {
            var places = judgments(
                counts(0, 0, 0, 1, 1, 3, 5),   // Excellent option
                counts(0, 0, 1, 1, 3, 4, 1),   // VeryGood option
                counts(0, 1, 1, 3, 4, 1, 0),   // Good option
                counts(1, 1, 3, 4, 1, 0, 0),   // Fair option
                counts(5, 3, 1, 1, 0, 0, 0));  // poor option

            assertThat(ranksOf(places)).containsExactly(1, 2, 3, 4, 5);
        }

        @Test
        void areSharedByWhatStaysTied() {
            var places = judgments(
                counts(1, 1, 1, 1, 2, 2, 2),
                counts(1, 1, 1, 1, 2, 2, 2));

            assertThat(ranksOf(places)).containsExactly(1, 1);
        }

        @Test
        void areSharedByEveryOptionWhenAllAreTied() {
            var places = judgments(
                counts(1, 1, 1, 2, 2, 2, 1),
                counts(1, 1, 1, 2, 2, 2, 1),
                counts(1, 1, 1, 2, 2, 2, 1));

            assertThat(ranksOf(places)).containsExactly(1, 1, 1);
        }

        /** Three options tied at 2 are followed by 5, never by 3. */
        @Test
        void countTheOptionsAheadNotTheRanksAhead() {
            var places = judgments(
                counts(0, 0, 1, 1, 1, 3, 4),   // the winner
                counts(1, 1, 2, 2, 2, 1, 1),   // tied
                counts(1, 1, 2, 2, 2, 1, 1),   // tied
                counts(1, 1, 2, 2, 2, 1, 1),   // tied
                counts(5, 3, 1, 1, 0, 0, 0));  // last

            assertThat(ranksOf(places)).containsExactly(1, 2, 2, 2, 5);
        }

        @Test
        void mixTiesAndClearPlaces() {
            var places = judgments(
                counts(0, 0, 1, 1, 2, 3, 3),
                counts(0, 0, 1, 1, 2, 3, 3),
                counts(1, 1, 2, 3, 2, 1, 0),
                counts(2, 2, 3, 2, 1, 0, 0),
                counts(2, 2, 3, 2, 1, 0, 0));

            assertThat(ranksOf(places)).containsExactly(1, 1, 3, 4, 4);
        }

        /** Two options with the same majority mention, separated by their score. */
        @Test
        void breakATieOnTheMajorityMentionByTheScore() {
            var a = counts(0, 0, 2, 3, 3, 2, 0);
            var b = counts(0, 1, 1, 3, 3, 2, 0);

            assertThat(mentionOf(a)).isEqualTo("Fair");
            assertThat(mentionOf(b)).isEqualTo("Fair");
            assertThat(ranksOf(judgments(a, b))).containsExactly(1, 1); // the same score: still tied
        }

        @Test
        void putAConsensualOptionAboveADivisiveOne() {
            var divisive = counts(5, 0, 0, 0, 0, 0, 5);
            var consensual = counts(0, 0, 0, 10, 0, 0, 0);

            assertThat(ranksOf(judgments(divisive, consensual))).containsExactly(2, 1);
        }

        /**
         * Exactly tied, whatever their order in the poll. Computed from
         * proportions, these two rounded to 0.5000000000000001 and 0.5.
         */
        @Test
        void areTheSameForExactlyEqualScores() {
            var a = counts(7, 0, 0, 0, 4, 0, 9);
            var b = counts(4, 0, 0, 0, 8, 0, 8);

            assertThat(scoreOf(a)).isEqualTo(new Score(2, 4));
            assertThat(scoreOf(b)).isEqualTo(new Score(4, 8));
            assertThat(ranksOf(judgments(a, b))).containsExactly(1, 1);
            assertThat(ranksOf(judgments(b, a))).containsExactly(1, 1);
        }

        /**
         * Scores closer than a double can tell stay apart: with a billion
         * ballots, dividing the counts would make these two equal.
         */
        @Test
        void keepApartScoresCloserThanADoubleCanTell() {
            var a = counts(0, 0, 0, 0, 1_000_000_000, 333_333_333, 0);
            var b = counts(0, 0, 0, 0, 1_000_000_003, 333_333_334, 0);

            assertThat(scoreOf(a).numerator() / (double) scoreOf(a).denominator())
                .isEqualTo(scoreOf(b).numerator() / (double) scoreOf(b).denominator());
            assertThat(ranksOf(judgments(a, b))).containsExactly(2, 1);
        }
    }

    @Nested
    class ApprovalPolls {

        @Test
        void rankByTheirApprovals() {
            var places = Ranking.of(APPROVAL, approvals(3, 7, 5), 3);

            assertThat(ranksOf(places)).containsExactly(3, 1, 2);
        }

        @Test
        void shareARankWhenTheyShareACount() {
            var places = Ranking.of(APPROVAL, approvals(7, 7, 2), 3);

            assertThat(ranksOf(places)).containsExactly(1, 1, 3);
        }

        /** No majority mention and no score: there is nothing to tie-break with. */
        @Test
        void haveNoMajorityMention() {
            var place = Ranking.of(APPROVAL, approvals(1), 1).getFirst();

            assertThat(place.majorityMention()).isNull();
            assertThat(place.score()).isNull();
        }
    }

    // --- helpers --------------------------------------------------------------

    /** The seven counts of one option, worst mention first. */
    static List<Long> counts(long bad, long inadequate, long passable, long fair, long good, long veryGood,
                             long excellent) {
        return List.of(bad, inadequate, passable, fair, good, veryGood, excellent);
    }

    @SafeVarargs
    static List<Ranking.Place> judgments(List<Long>... options) {
        return Ranking.of(MAJORITY_JUDGMENT, new Tally(ballots(options[0]), List.of(options)), options.length);
    }

    static Tally approvals(long... approved) {
        var counts = new ArrayList<List<Long>>(approved.length);
        var most = 0L;
        for (var option : approved) {
            counts.add(List.of(0L, option)); // not approved, approved
            most = Math.max(most, option);
        }
        return new Tally(most, counts);
    }

    static String mentionOf(List<Long> counts) {
        return judgments(counts).getFirst().majorityMention();
    }

    static Score scoreOf(List<Long> counts) {
        return judgments(counts).getFirst().score();
    }

    static List<Integer> ranksOf(List<Ranking.Place> places) {
        return places.stream().map(Ranking.Place::rank).toList();
    }

    private static long ballots(List<Long> counts) {
        return counts.stream().mapToLong(Long::longValue).sum();
    }

}
