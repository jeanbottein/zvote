/**
 * The shapes the zvote API sends and receives. They mirror the server's DTOs
 * (servers/java/.../api/dto) one to one.
 */
import type { JudgmentCounts } from '../utils/majorityJudgment';

/** One of the seven majority judgment mentions, as spelled on the wire. */
export type Mention = keyof JudgmentCounts;

export type VotingSystem = 'MAJORITY_JUDGMENT' | 'APPROVAL';

/**
 * When a poll's results show while it is open (once closed, they always do):
 * live, once `resultsAfterBallots` ballots are in, or only once closed.
 */
export type ResultsShown = 'LIVE' | 'AFTER_BALLOTS' | 'AFTER_CLOSING';

/** Whether a poll is listed publicly. Anyone with the link or the join code can open either kind. */
export type Visibility = 'PUBLIC' | 'UNLISTED';

/**
 * Whether the caller may vote: anyone may, on a poll that takes no
 * invitations. On one that does, its creator may, and whoever brings an
 * invitation (NOT_INVITED: none, or not a valid one), which then holds their
 * ballot in their browser only (INVITATION_USED: it was used in another).
 */
export type Admission = 'ADMITTED' | 'NOT_INVITED' | 'INVITATION_USED';

export interface PollOption {
  id: string;
  label: string;
  /** Approval polls only. Null while the poll keeps its results back. */
  approvalCount: number | null;
  /** Majority judgment polls only: how many voters gave each mention. Null while the poll keeps its results back. */
  judgmentCounts: JudgmentCounts | null;
}

/** The caller's own ballot, and the name they gave with it (polls that show names). */
export interface MyBallot {
  approvedOptionIds: string[] | null;
  judgments: Record<string, Mention> | null;
  voterName: string | null;
}

/** A poll as the calling voter sees it. Its id is its share token; its join code, a short stand-in to type. */
export interface Poll {
  id: string;
  joinCode: string;
  title: string;
  votingSystem: VotingSystem;
  visibility: Visibility;
  /** Chosen at creation: only people its creator invites may vote, each with a link of their own. */
  invitationOnly: boolean;
  /** Chosen at creation: voters may give a name, which everyone on the poll sees. */
  showVoterNames: boolean;
  /** Chosen at creation: when the results show. Until then, the options carry no counts. */
  resultsShown: ResultsShown;
  /** AFTER_BALLOTS only: how many ballots must be in. */
  resultsAfterBallots: number | null;
  createdAt: string;
  closedAt: string | null;
  /** When the server deletes the poll, with its ballots. */
  expiresAt: string;
  isMine: boolean;
  admission: Admission;
  totalBallots: number;
  options: PollOption[];
  /** Polls that show names: the first names voters gave, in alphabetical order. Never what they chose. */
  voterNames: string[] | null;
  /** More voters gave a name than voterNames holds. */
  moreVoterNames: boolean;
  myBallot: MyBallot | null;
}

/** What a poll's watchers receive live: what changes, the same for every watcher. */
export type PollUpdate = Pick<Poll, 'closedAt' | 'totalBallots' | 'options' | 'voterNames' | 'moreVoterNames'>;

export type PollSummary = Pick<
  Poll,
  'id' | 'title' | 'votingSystem' | 'visibility' | 'createdAt' | 'closedAt' | 'isMine'
>;

export interface NewPoll {
  title: string;
  options: string[];
  votingSystem: VotingSystem;
  visibility: Visibility;
  invitationOnly: boolean;
  showVoterNames: boolean;
  resultsShown: ResultsShown;
  resultsAfterBallots: number | null;
}

/**
 * An invitation, as the creator of its poll sees it: the token its link
 * carries, whom it is for (null: they did not say), and whether someone
 * voted with it. Never what they chose.
 */
export interface Invitation {
  token: string;
  label: string | null;
  used: boolean;
}

/**
 * A whole ballot, replacing the previous one. An empty ballot withdraws. On a
 * poll that shows names, the voter's name goes with it; without one, they
 * take part anonymously.
 */
export type BallotRequest = ({ judgments: Record<string, Mention> } | { approvedOptionIds: string[] }) & {
  voterName?: string | null;
};

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
    maxVoterNameLength: number;
    maxInvitations: number;
    pollLifetimeDays: number;
  };
}
