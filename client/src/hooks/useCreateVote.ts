import { useState, useCallback } from 'react';
import { VotingSystem } from '../generated/index';
import { spacetimeDB } from '../lib/spacetimeClient';

interface CreateVoteParams {
  title: string;
  description?: string;
  visibility: number; // 0=Public, 1=Unlisted, 2=Private
  votingSystem: VotingSystem;
  options: string[];
}

interface CreateVoteResult {
  voteId?: string;
  token?: string;
  error?: string;
}

export const useCreateVote = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [lastResult, setLastResult] = useState<CreateVoteResult | null>(null);

  const createVote = useCallback(async (params: CreateVoteParams): Promise<CreateVoteResult> => {
    if (!spacetimeDB.currentUser) {
      const error = 'You must be connected to create a vote';
      setLastResult({ error });
      return { error };
    }

    setIsCreating(true);
    setLastResult(null);

    try {
      // Clean and validate options
      const cleanOptions = params.options
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);

      if (cleanOptions.length < 2) {
        throw new Error('At least 2 options are required');
      }

      // Check duplicates
      const uniqueOptions = new Set(cleanOptions.map(opt => opt.toLowerCase()));
      if (uniqueOptions.size !== cleanOptions.length) {
        throw new Error('Options must be unique');
      }

      // Call create_vote reducer with new API
      // Order: title, options, visibility, votingSystem
      await spacetimeDB.call(
        'createVote',
        params.title.trim(),
        cleanOptions,
        params.visibility,
        params.votingSystem
      );

      // TODO: SpacetimeDB should return the created vote ID
      // For now, simulate success
      const success: CreateVoteResult = {
        voteId: 'temp-vote-id', // À remplacer par l'ID réel
        token: 'temp-token' // À remplacer par le token réel
      };

      setLastResult(success);
      return success;

    } catch (error) {
      console.error('Error creating vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: CreateVoteResult = { error: errorMessage };
      
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    createVote,
    isCreating,
    lastResult,
    clearResult
  };
};
