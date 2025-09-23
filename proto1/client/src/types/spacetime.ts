// Types générés à partir des structures Rust SpacetimeDB

export type Identity = string;
export type Timestamp = number;

export enum VotingSystem {
  Approval = 'Approval',
  MajorityJudgment = 'MajorityJudgment'
}

export enum Mention {
  ToReject = 'ToReject',
  Passable = 'Passable', 
  Good = 'Good',
  VeryGood = 'VeryGood',
  Excellent = 'Excellent'
}

export interface Vote {
  id: string;
  creator: Identity;
  title: string;
  public: boolean;
  created_at: Timestamp;
  token: string;
  voting_system: VotingSystem;
}

export interface VoteOption {
  id: string;
  vote_id: string;
  label: string;
  approvals_count: number;
  order_index: number;
}

export interface Judgment {
  id: string;
  option_id: string;
  voter: Identity;
  mention: Mention;
}

// Types dérivés pour l'affichage
export interface VoteResults {
  vote: Vote;
  options: VoteOption[];
  judgments: Judgment[];
  totalVoters: number;
  isLoading: boolean;
  error: string | null;
}

export interface OptionResult {
  option: VoteOption;
  majorityMention: Mention;
  mentionCounts: Record<Mention, number>;
  totalVoters: number;
  percentages: Record<Mention, number>;
}
