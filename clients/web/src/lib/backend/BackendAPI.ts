/**
 * Backend API Interface
 * 
 * This interface defines all backend operations that the UI needs.
 * We have two implementations:
 * - SpacetimeBackend: Uses SpacetimeDB with real-time subscriptions
 * - GraphQLBackend: Uses Java GraphQL server with REST API
 */

export interface Vote {
  id: string;
  title: string;
  votingSystem: 'Approval' | 'MajorityJudgment';
  visibility: 'Public' | 'Private' | 'Unlisted';
  creatorId: string;
  createdAt: Date;
  shareToken: string;
  options: VoteOption[];
}

export interface VoteOption {
  id: string;
  voteId: string;
  label: string;
  orderIndex: number;
  approvalsCount: number;
  judgmentCounts?: {
    ToReject: number;
    Insufficient: number;
    OnlyAverage: number;
    GoodEnough: number;
    Good: number;
    VeryGood: number;
    Excellent: number;
  };
  totalJudgments?: number;
}

export interface CreateVoteParams {
  title: string;
  votingSystem: 'Approval' | 'MajorityJudgment';
  visibility: 'Public' | 'Private' | 'Unlisted';
  options: string[];
}

export interface VoteResult {
  vote: Vote;
  error?: string;
}

/**
 * Backend API interface that both implementations must satisfy
 */
export interface BackendAPI {
  /**
   * Initialize the backend connection
   */
  initialize(): Promise<void>;

  /**
   * Disconnect from backend
   */
  disconnect(): void;

  /**
   * Get all votes
   */
  getVotes(): Promise<Vote[]>;

  /**
   * Get a single vote by token
   */
  getVoteByToken(token: string): Promise<Vote | null>;

  /**
   * Create a new vote
   */
  createVote(params: CreateVoteParams): Promise<VoteResult>;

  /**
   * Cast an approval vote
   */
  approve(voteId: string, optionId: string): Promise<void>;

  /**
   * Remove an approval vote
   */
  unapprove(voteId: string, optionId: string): Promise<void>;

  /**
   * Cast a majority judgment vote
   */
  castJudgment(
    optionId: string,
    mention: 'ToReject' | 'Insufficient' | 'OnlyAverage' | 'GoodEnough' | 'Good' | 'VeryGood' | 'Excellent'
  ): Promise<void>;

  /**
   * Delete a vote
   */
  deleteVote(voteId: string): Promise<void>;

  /**
   * Subscribe to vote changes (for real-time updates)
   * Returns unsubscribe function
   */
  onVotesChange(callback: (votes: Vote[]) => void): () => void;

  /**
   * Check if connected/ready
   */
  isReady(): boolean;

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null;

  /**
   * Check if current user is the creator of a vote
   */
  isVoteOwner(voteId: string, creatorId: string): Promise<boolean>;
}
