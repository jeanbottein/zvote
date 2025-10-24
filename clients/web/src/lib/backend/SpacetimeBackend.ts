/**
 * SpacetimeDB Backend Implementation
 * 
 * Wraps the existing SpacetimeDB client to implement the BackendAPI interface.
 * Provides real-time updates via subscriptions.
 */

import type { BackendAPI, Vote, VoteOption, CreateVoteParams, VoteResult } from './BackendAPI';
import { spacetimeDB } from '../spacetimeClient';

export class SpacetimeBackend implements BackendAPI {
  private changeCallbacks = new Set<(votes: Vote[]) => void>();
  
  constructor() {
    console.log('[SpacetimeBackend] Constructed');
  }

  async initialize(): Promise<void> {
    console.log('[SpacetimeBackend] Initializing...');
    // SpacetimeDB client auto-connects, just wait for it
    await spacetimeDB.connect();
    console.log('[SpacetimeBackend] Connected successfully');
  }

  disconnect(): void {
    console.log('[SpacetimeBackend] Disconnecting...');
    spacetimeDB.disconnect();
    this.changeCallbacks.clear();
  }

  async getVotes(): Promise<Vote[]> {
    // TODO: Query votes from SpacetimeDB tables
    console.log('[SpacetimeBackend] getVotes() - TODO');
    return [];
  }

  async getVoteByToken(token: string): Promise<Vote | null> {
    // TODO: Query vote by token from SpacetimeDB
    console.log('[SpacetimeBackend] getVoteByToken() - TODO:', token);
    return null;
  }

  async createVote(params: CreateVoteParams): Promise<VoteResult> {
    // TODO: Call SpacetimeDB reducer for creating vote
    console.log('[SpacetimeBackend] createVote() - TODO:', params);
    throw new Error('Not implemented');
  }

  async approve(voteId: string, optionId: string): Promise<void> {
    // Use existing spacetimeDB reducers
    await spacetimeDB.reducers.approve(BigInt(voteId), BigInt(optionId));
  }

  async unapprove(voteId: string, optionId: string): Promise<void> {
    // Use existing spacetimeDB reducers
    await spacetimeDB.reducers.unapprove(BigInt(voteId), BigInt(optionId));
  }

  async castJudgment(
    optionId: string,
    mention: 'ToReject' | 'Insufficient' | 'OnlyAverage' | 'GoodEnough' | 'Good' | 'VeryGood' | 'Excellent'
  ): Promise<void> {
    // TODO: Map mention string to SpacetimeDB Mention type and call reducer
    console.log('[SpacetimeBackend] castJudgment() - TODO:', { optionId, mention });
  }

  async deleteVote(voteId: string): Promise<void> {
    const voteIdNum = parseInt(voteId, 10);
    if (isNaN(voteIdNum)) {
      throw new Error('Invalid vote ID');
    }
    await spacetimeDB.reducers.deleteVote(voteIdNum);
  }

  onVotesChange(callback: (votes: Vote[]) => void): () => void {
    this.changeCallbacks.add(callback);
    
    // TODO: Set up SpacetimeDB table listeners and call callback when votes change
    
    return () => this.changeCallbacks.delete(callback);
  }

  isReady(): boolean {
    return spacetimeDB.connection !== null;
  }

  getCurrentUserId(): string | null {
    return spacetimeDB.currentUser?.identity || null;
  }

  async isVoteOwner(voteId: string, creatorId: string): Promise<boolean> {
    if (!spacetimeDB.connection || !spacetimeDB.identityObject) {
      return false;
    }

    try {
      const db = spacetimeDB.connection.db as any;
      const voteIdNum = parseInt(voteId, 10);
      
      if (isNaN(voteIdNum)) {
        return false;
      }

      const vote = db.vote.id.find(voteIdNum);
      if (!vote) {
        return false;
      }

      // Use deepEqual for robust identity comparison
      const { deepEqual } = await import('spacetimedb');
      return deepEqual(vote.creator, spacetimeDB.identityObject);
    } catch (error) {
      console.error('[SpacetimeBackend] Error checking vote ownership:', error);
      return false;
    }
  }
}
