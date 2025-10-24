import { useState, useCallback } from 'react';
import { VotingSystem } from '../generated/index';
import { getBackend } from '../lib/backend';

interface CreateVoteParams {
  title: string;
  description?: string;
  visibility: number; // 0=Public, 1=Unlisted, 2=Private
  votingSystem: VotingSystem;
  options: string[];
  limitByIp?: boolean;
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
    const backend = await getBackend();
    const currentUserId = backend.getCurrentUserId();
    
    if (!currentUserId) {
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

      // Map visibility number to string
      const visibilityMap: Record<number, 'Public' | 'Private' | 'Unlisted'> = {
        0: 'Public',
        1: 'Unlisted',
        2: 'Private'
      };

      // Call backend createVote
      const result = await backend.createVote({
        title: params.title.trim(),
        options: cleanOptions,
        visibility: visibilityMap[params.visibility] || 'Public',
        votingSystem: params.votingSystem.tag === 'Approval' ? 'Approval' : 'MajorityJudgment'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const success: CreateVoteResult = {
        voteId: result.vote.id,
        token: result.vote.shareToken
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
