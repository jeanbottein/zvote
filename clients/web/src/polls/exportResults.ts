import type { Poll } from '../api/types';
import { rankByApprovals } from '../features/VotingSystem/Approval/approvalRanking';
import { toRankable } from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentResults';
import { rankOptions } from '../utils/majorityJudgment';

/** The results as a self-describing document, for anyone who wants to check or archive them. */
export function resultsDocument(poll: Poll, exportedAt = new Date()) {
  return {
    poll: {
      id: poll.id,
      title: poll.title,
      votingSystem: poll.votingSystem,
      createdAt: poll.createdAt,
      closedAt: poll.closedAt,
    },
    exportedAt: exportedAt.toISOString(),
    totalBallots: poll.totalBallots,
    ranking: poll.votingSystem === 'MAJORITY_JUDGMENT'
      ? rankOptions(toRankable(poll.options)).map((option) => ({
          rank: option.mjAnalysis.rank,
          label: option.label,
          majorityMention: option.mjAnalysis.majorityMention,
          gmjScore: option.mjAnalysis.gmdScore,
          judgmentCounts: option.judgment_counts,
        }))
      : rankByApprovals(poll.options).map((standing) => ({
          rank: standing.rank,
          label: standing.label,
          approvals: standing.approvals,
        })),
  };
}

export function downloadResults(poll: Poll) {
  const json = JSON.stringify(resultsDocument(poll), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `zvote-results-${poll.id}.json`;
  link.click();
  // Not at once: a browser may read the file after click() returns, Safari on iOS notably.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
