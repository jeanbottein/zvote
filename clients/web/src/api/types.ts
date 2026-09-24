/**
 * The shapes the zvote API sends and receives. They mirror the server's DTOs
 * (servers/java/.../api/dto) one to one.
 */
import type { JudgmentCounts } from '../utils/majorityJudgment';

/** One of the seven majority judgment mentions, as spelled on the wire. */
export type Mention = keyof JudgmentCounts;

export type VotingSystem = 'MAJORITY_JUDGMENT' | 'APPROVAL';

/** Whether a poll is listed publicly. Anyone with the link can open either kind. */
export type Visibility = 'PUBLIC' | 'UNLISTED';

export interface PollOption {
  id: string;
  label: string;
  /** Approval polls only. */
  approvalCount: number | null;
  /** Majority judgment polls only: how many voters gave each mention. */
  judgmentCounts: JudgmentCounts | null;
}

/** The caller's own ballot. */
export interface MyBallot {
  approvedOptionIds: string[] | null;
  judgments: Record<string, Mention> | null;
}

/** A poll as the calling voter sees it. Its id is its share token. */
export interface Poll {
  id: string;
  title: string;
  votingSystem: VotingSystem;
  visibility: Visibility;
  createdAt: string;
  closedAt: string | null;
  isMine: boolean;
  totalBallots: number;
  options: PollOption[];
  myBallot: MyBallot | null;
}

/** What a poll's watchers receive live: what changes, and nothing about any one voter. */
export type PollUpdate = Pick<Poll, 'closedAt' | 'totalBallots' | 'options'>;

export type PollSummary = Pick<
  Poll,
  'id' | 'title' | 'votingSystem' | 'visibility' | 'createdAt' | 'closedAt' | 'isMine'
>;

export interface NewPoll {
  title: string;
  options: string[];
  votingSystem: VotingSystem;
  visibility: Visibility;
}

/** A whole ballot, replacing the previous one. An empty ballot withdraws. */
export type BallotRequest = { judgments: Record<string, Mention> } | { approvedOptionIds: string[] };

export interface ServerInfo {
  features: {
    publicPolls: boolean;
    unlistedPolls: boolean;
    approvalVoting: boolean;
    majorityJudgment: boolean;
  };
  limits: {
    maxOptions: number;
    maxTitleLength: number;
    maxOptionLength: number;
  };
}
