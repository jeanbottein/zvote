package org.zvote.server.ballots.judgment;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Majority judgment ballots: each voter gives every option one mention.
 *
 * The server only stores ballots and counts them. Medians, scores and the
 * ranking are computed by the client from the seven tallies per option.
 */
@Service
public class JudgmentBallotService {

    private final JudgmentRepository judgments;

    public JudgmentBallotService(JudgmentRepository judgments) {
        this.judgments = judgments;
    }

    /**
     * Replaces this voter's ballot wholesale: casting, revising and withdrawing
     * are one operation, and an empty ballot withdraws.
     *
     * Options the voter left ungraded get BAD, the majority judgment convention
     * for "no opinion", so every ballot grades every option and the medians of
     * different options stay comparable.
     */
    @Transactional
    public void cast(Long pollId, String voterId, Map<Long, Mention> mentions, List<Long> optionIds) {
        judgments.deleteBallot(pollId, voterId);
        if (mentions.isEmpty()) {
            return;
        }
        var now = Instant.now();
        judgments.saveAll(optionIds.stream()
            .map(optionId -> new Judgment(
                null, pollId, optionId, voterId, mentions.getOrDefault(optionId, Mention.BAD), now))
            .toList());
    }

    /** This voter's mentions by option id; empty if they have not voted. */
    public Map<Long, Mention> ballotOf(Long pollId, String voterId) {
        var ballot = new HashMap<Long, Mention>();
        for (var judgment : judgments.findByPollIdAndVoterId(pollId, voterId)) {
            ballot.put(judgment.optionId(), judgment.mention());
        }
        return ballot;
    }

    /** The seven tallies of every option, worst mention first, zero-filled. */
    public Map<Long, Map<Mention, Long>> tallies(Long pollId, List<Long> optionIds) {
        var tallies = new LinkedHashMap<Long, Map<Mention, Long>>();
        for (var optionId : optionIds) {
            var zeroes = new EnumMap<Mention, Long>(Mention.class);
            for (var mention : Mention.values()) {
                zeroes.put(mention, 0L);
            }
            tallies.put(optionId, zeroes);
        }
        for (var count : judgments.countByOptionAndMention(pollId)) {
            tallies.get(count.optionId()).put(count.mention(), count.total());
        }
        return tallies;
    }

    public long ballotCount(Long pollId) {
        return judgments.countBallots(pollId);
    }
}
