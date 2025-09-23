import { useState, useCallback } from 'react';
import { Mention } from '../types/spacetime';
import { spacetimeDB } from '../lib/spacetimeClient';

export interface VoteActions {
  castJudgment: (optionId: string, mention: Mention) => Promise<void>;
  withdrawVote: (voteId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useVoteActions = (): VoteActions => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const castJudgment = useCallback(async (optionId: string, mention: Mention) => {
    if (!spacetimeDB.currentUser) {
      setError('Vous devez être connecté pour voter');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await spacetimeDB.call('cast_judgment', optionId, mention);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du vote';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const withdrawVote = useCallback(async (voteId: string) => {
    if (!spacetimeDB.currentUser) {
      setError('Vous devez être connecté pour retirer votre vote');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ce réducteur n'existe pas encore côté serveur - il faudra le créer
      await spacetimeDB.call('withdraw_vote', voteId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du retrait du vote';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    castJudgment,
    withdrawVote,
    isLoading,
    error
  };
};
