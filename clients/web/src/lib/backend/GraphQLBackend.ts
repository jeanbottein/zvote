/**
 * GraphQL Backend Implementation
 * 
 * Uses the Java GraphQL server for all operations.
 * Implements the BackendAPI interface.
 */

import type { BackendAPI, Vote, VoteOption, CreateVoteParams, VoteResult } from './BackendAPI';
import { getConfig } from '../../../config';

export class GraphQLBackend implements BackendAPI {
  private ready = false;
  private changeCallbacks = new Set<(votes: Vote[]) => void>();
  private baseUrl: string;

  constructor() {
    const config = getConfig();
    // Use same-origin /graphql endpoint (proxied by Vite in dev)
    this.baseUrl = '/graphql';
    console.log('[GraphQLBackend] Configured with baseUrl:', this.baseUrl);
  }

  async initialize(): Promise<void> {
    console.log('[GraphQLBackend] Initializing...');
    // For GraphQL, we don't need a persistent connection
    // Just verify the endpoint is reachable
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '{ serverInfo { version } }'
        })
      });
      
      if (!response.ok) {
        throw new Error(`GraphQL server returned ${response.status}`);
      }
      
      this.ready = true;
      console.log('[GraphQLBackend] Connected successfully');
    } catch (error) {
      console.error('[GraphQLBackend] Failed to connect:', error);
      throw error;
    }
  }

  disconnect(): void {
    console.log('[GraphQLBackend] Disconnecting...');
    this.ready = false;
    this.changeCallbacks.clear();
  }

  async getVotes(): Promise<Vote[]> {
    const query = `
      query GetVotes {
        votes {
          id
          title
          votingSystem
          visibility
          creatorId
          createdAt
          shareToken
          options {
            id
            label
            orderIndex
            approvalsCount
            judgmentCounts {
              ToReject
              Insufficient
              OnlyAverage
              GoodEnough
              Good
              VeryGood
              Excellent
            }
            totalJudgments
          }
        }
      }
    `;
    
    const data = await this.query<{ votes: any[] }>(query);
    return this.mapVotes(data.votes);
  }

  async getVoteByToken(token: string): Promise<Vote | null> {
    const query = `
      query GetVoteByToken($token: String!) {
        voteByToken(token: $token) {
          id
          title
          votingSystem
          visibility
          creatorId
          createdAt
          shareToken
          options {
            id
            label
            orderIndex
            approvalsCount
            judgmentCounts {
              ToReject
              Insufficient
              OnlyAverage
              GoodEnough
              Good
              VeryGood
              Excellent
            }
            totalJudgments
          }
        }
      }
    `;
    
    const data = await this.query<{ voteByToken: any }>(query, { token });
    return data.voteByToken ? this.mapVote(data.voteByToken) : null;
  }

  async createVote(params: CreateVoteParams): Promise<VoteResult> {
    const mutation = `
      mutation CreateVote($input: CreateVoteInput!) {
        createVote(input: $input) {
          vote {
            id
            title
            votingSystem
            visibility
            creatorId
            createdAt
            shareToken
            options {
              id
              label
              orderIndex
              approvalsCount
            }
          }
          error
        }
      }
    `;
    
    const input = {
      title: params.title,
      votingSystem: params.votingSystem,
      visibility: params.visibility,
      options: params.options
    };
    
    const data = await this.query<{ createVote: any }>(mutation, { input });
    
    if (data.createVote.error) {
      return {
        vote: null as any,
        error: data.createVote.error
      };
    }
    
    return {
      vote: this.mapVote(data.createVote.vote)
    };
  }

  async approve(voteId: string, optionId: string): Promise<void> {
    const mutation = `
      mutation ApproveOption($voteId: ID!, $optionId: ID!) {
        approve(voteId: $voteId, optionId: $optionId) {
          success
        }
      }
    `;
    
    await this.query(mutation, { voteId, optionId });
  }

  async unapprove(voteId: string, optionId: string): Promise<void> {
    const mutation = `
      mutation UnapproveOption($voteId: ID!, $optionId: ID!) {
        unapprove(voteId: $voteId, optionId: $optionId) {
          success
        }
      }
    `;
    
    await this.query(mutation, { voteId, optionId });
  }

  async castJudgment(
    optionId: string,
    mention: 'ToReject' | 'Insufficient' | 'OnlyAverage' | 'GoodEnough' | 'Good' | 'VeryGood' | 'Excellent'
  ): Promise<void> {
    const mutation = `
      mutation CastJudgment($optionId: ID!, $mention: String!) {
        castJudgment(optionId: $optionId, mention: $mention) {
          success
        }
      }
    `;
    
    await this.query(mutation, { optionId, mention });
  }

  async deleteVote(voteId: string): Promise<void> {
    const mutation = `
      mutation DeleteVote($voteId: ID!) {
        deleteVote(voteId: $voteId) {
          success
        }
      }
    `;
    
    await this.query(mutation, { voteId });
  }

  onVotesChange(callback: (votes: Vote[]) => void): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  isReady(): boolean {
    return this.ready;
  }

  getCurrentUserId(): string | null {
    // TODO: Get user ID from authentication context/token
    // For development, return a mock user ID
    return 'graphql-user-1';
  }

  async isVoteOwner(voteId: string, creatorId: string): Promise<boolean> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return false;
    }
    
    // Simple comparison for GraphQL backend
    return currentUserId === creatorId;
  }

  /**
   * Helper method to execute GraphQL queries
   */
  private async query<T = any>(query: string, variables?: any): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  /**
   * Helper method to map GraphQL vote to BackendAPI Vote type
   */
  private mapVote(gqlVote: any): Vote {
    return {
      id: gqlVote.id,
      title: gqlVote.title,
      votingSystem: gqlVote.votingSystem,
      visibility: gqlVote.visibility,
      creatorId: gqlVote.creatorId,
      createdAt: new Date(gqlVote.createdAt),
      shareToken: gqlVote.shareToken,
      options: gqlVote.options?.map((opt: any) => this.mapOption(opt, gqlVote.id)) || []
    };
  }

  /**
   * Helper method to map GraphQL votes array
   */
  private mapVotes(gqlVotes: any[]): Vote[] {
    return gqlVotes.map(v => this.mapVote(v));
  }

  /**
   * Helper method to map GraphQL option to BackendAPI VoteOption type
   */
  private mapOption(gqlOption: any, voteId: string): VoteOption {
    return {
      id: gqlOption.id,
      voteId: voteId,
      label: gqlOption.label,
      orderIndex: gqlOption.orderIndex,
      approvalsCount: gqlOption.approvalsCount || 0,
      judgmentCounts: gqlOption.judgmentCounts,
      totalJudgments: gqlOption.totalJudgments
    };
  }
}
