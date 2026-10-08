package org.zvote.server.api;

import org.junit.jupiter.api.Test;
import org.zvote.server.ballots.Mention;
import org.zvote.server.ballots.Tally;
import org.zvote.server.polls.PollOption;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.zvote.server.polls.Poll.VotingSystem.APPROVAL;
import static org.zvote.server.polls.Poll.VotingSystem.MAJORITY_JUDGMENT;

/** Stored ballots depend on this format: it must never change. */
class BallotFormatTest {

    final List<PollOption> options = List.of(
        new PollOption(11L, 1L, 0, "Ramen"), new PollOption(12L, 1L, 1, "Tacos"), new PollOption(13L, 1L, 2, "Pho"));

    @Test
    void anApprovalBallotIsAOneForEachApprovedOption() {
        var choices = BallotFormat.encodeApprovals(Set.of(11L, 13L), options);

        assertThat(choices).containsExactly(1, 0, 1);
        assertThat(BallotFormat.decodeApprovals(choices, options)).containsExactly("11", "13");
    }

    @Test
    void aMajorityJudgmentBallotIsEachMentionsRankWithBadForWhatWasNotGraded() {
        var choices = BallotFormat.encodeJudgments(Map.of(11L, Mention.EXCELLENT, 12L, Mention.FAIR), options);

        assertThat(choices).containsExactly(6, 3, 0);
        assertThat(BallotFormat.decodeJudgments(choices, options))
            .containsExactly(entry("11", "Excellent"), entry("12", "Fair"), entry("13", "Bad"));
    }

    @Test
    void talliesCountEveryChoiceAnOptionCanGet() {
        var tally = new Tally(3, List.of(List.of(1L, 2L), List.of(3L, 0L)));

        assertThat(BallotFormat.choices(APPROVAL)).isEqualTo(2);
        assertThat(BallotFormat.choices(MAJORITY_JUDGMENT)).isEqualTo(7);
        assertThat(BallotFormat.approvals(tally, 0)).isEqualTo(2);
        assertThat(BallotFormat.approvals(tally, 1)).isZero();
    }
}
