import type { Poll } from '../api/types';
import { gmjScore } from '../features/VotingSystem/MajorityJudgment/gmjScore';
import { ranked } from '../features/VotingSystem/ranked';

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
    ranking: ranked(poll.options).map(({ option, rank }) => poll.votingSystem === 'MAJORITY_JUDGMENT'
      ? {
          rank,
          label: option.label,
          majorityMention: option.majorityMention,
          gmjScore: option.score && gmjScore(option.score),
          judgmentCounts: option.judgmentCounts,
        }
      : {
          rank,
          label: option.label,
          approvals: option.approvalCount ?? 0,
        }),
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
