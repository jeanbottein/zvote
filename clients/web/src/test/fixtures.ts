import type { JudgmentCounts, Poll, PollOption, ServerInfo } from '../api/types';

/** What a server offers by default, with some features changed. */
export function serverInfo(features: Partial<ServerInfo['features']> = {}): ServerInfo {
  return {
    features: { publicPolls: false, unlistedPolls: true, approvalVoting: true, majorityJudgment: true, ...features },
    limits: {
      maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100, maxVoterNameLength: 40, maxInvitations: 1000,
      pollLifetimeDays: 30,
    },
    publicUrl: null,
  };
}

export const NO_JUDGMENTS: JudgmentCounts = {
  Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0,
};

/**
 * One option as the server sends it: its counts, and the place the server
 * ranked it at. Tests state the ranking rather than computing it - the server
 * does that, and RankingTest is where it is checked.
 */
export function option(changes: Partial<PollOption> = {}): PollOption {
  return {
    id: '1',
    label: 'Ramen',
    approvalCount: null,
    judgmentCounts: null,
    rank: null,
    majorityMention: null,
    score: null,
    ...changes,
  };
}

/** "Where do we eat?": someone else's majority judgment poll on Ramen and Tacos, with no ballot yet. */
export function lunchPoll(changes: Partial<Poll> = {}): Poll {
  return {
    id: 'abc',
    joinCode: 'K7M4QX',
    title: 'Where do we eat?',
    votingSystem: 'MAJORITY_JUDGMENT',
    visibility: 'UNLISTED',
    invitationOnly: false,
    showVoterNames: false,
    resultsShown: 'LIVE',
    resultsAfterBallots: null,
    createdAt: '2026-09-24T10:00:00Z',
    closedAt: null,
    expiresAt: '2026-10-24T10:00:00Z',
    isMine: false,
    admission: 'ADMITTED',
    totalBallots: 0,
    options: [
      option({ id: '1', label: 'Ramen', judgmentCounts: NO_JUDGMENTS, rank: 1, majorityMention: 'Bad',
        score: { numerator: 0, denominator: 1 } }),
      option({ id: '2', label: 'Tacos', judgmentCounts: NO_JUDGMENTS, rank: 1, majorityMention: 'Bad',
        score: { numerator: 0, denominator: 1 } }),
    ],
    voterNames: null,
    moreVoterNames: false,
    myBallot: null,
    handover: null,
    ...changes,
  };
}
