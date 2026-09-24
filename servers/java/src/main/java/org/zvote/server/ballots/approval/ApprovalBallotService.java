package org.zvote.server.ballots.approval;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Approval ballots: each voter approves any number of options. */
@Service
public class ApprovalBallotService {

    private final ApprovalRepository approvals;

    public ApprovalBallotService(ApprovalRepository approvals) {
        this.approvals = approvals;
    }

    /**
     * Replaces this voter's ballot wholesale: casting, revising and withdrawing
     * are one operation, and approving nothing withdraws.
     */
    @Transactional
    public void cast(Long pollId, String voterId, Set<Long> approvedOptionIds) {
        approvals.deleteBallot(pollId, voterId);
        var now = Instant.now();
        approvals.saveAll(approvedOptionIds.stream()
            .map(optionId -> new Approval(null, pollId, optionId, voterId, now))
            .toList());
    }

    /** The option ids this voter approved; empty if they have not voted. */
    public Set<Long> ballotOf(Long pollId, String voterId) {
        return approvals.findByPollIdAndVoterId(pollId, voterId).stream()
            .map(Approval::optionId)
            .collect(Collectors.toSet());
    }

    /** Approvals per option, zero-filled for options nobody approved. */
    public Map<Long, Long> tallies(Long pollId, List<Long> optionIds) {
        var tallies = new LinkedHashMap<Long, Long>();
        optionIds.forEach(optionId -> tallies.put(optionId, 0L));
        for (var count : approvals.countByOption(pollId)) {
            tallies.put(count.optionId(), count.total());
        }
        return tallies;
    }

    public long ballotCount(Long pollId) {
        return approvals.countBallots(pollId);
    }
}
