import type { JudgmentCounts } from '../utils/majorityJudgment';
import type { Poll, ServerInfo } from '../api/types';

/** What a server offers by default, with some features changed. */
export function serverInfo(features: Partial<ServerInfo['features']> = {}): ServerInfo {
  return {
    features: { publicPolls: false, unlistedPolls: true, approvalVoting: true, majorityJudgment: true, ...features },
    limits: { maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100, maxVoterNameLength: 40, pollLifetimeDays: 30 },
  };
}

export const NO_JUDGMENTS: JudgmentCounts = {
  Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0,
};

/** "Where do we eat?": someone else's majority judgment poll on Ramen and Tacos, with no ballot yet. */
export function lunchPoll(changes: Partial<Poll> = {}): Poll {
  return {
    id: 'abc',
    joinCode: 'K7M4QX',
    title: 'Where do we eat?',
    votingSystem: 'MAJORITY_JUDGMENT',
    visibility: 'UNLISTED',
    showVoterNames: false,
    resultsShown: 'LIVE',
    resultsAfterBallots: null,
    createdAt: '2026-09-24T10:00:00Z',
    closedAt: null,
    expiresAt: '2026-10-24T10:00:00Z',
    isMine: false,
    totalBallots: 0,
    options: [
      { id: '1', label: 'Ramen', approvalCount: null, judgmentCounts: NO_JUDGMENTS },
      { id: '2', label: 'Tacos', approvalCount: null, judgmentCounts: NO_JUDGMENTS },
    ],
    voterNames: null,
    moreVoterNames: false,
    myBallot: null,
    ...changes,
  };
}
