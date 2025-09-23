import { useState, useCallback } from 'react';
import { VotingSystem, Visibility } from '../generated/index';
import { spacetimeDB } from '../lib/spacetimeClient';

interface CreateVoteParams {
  title: string;
  description?: string;
  visibility: Visibility;
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
      const error = 'Vous devez être connecté pour créer un vote';
      setLastResult({ error });
      return { error };
    }

    setIsCreating(true);
    setLastResult(null);

    try {
      // Nettoyer et valider les options
      const cleanOptions = params.options
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);

      if (cleanOptions.length < 2) {
        throw new Error('Au moins 2 options sont requises');
      }

      // Vérifier les doublons
      const uniqueOptions = new Set(cleanOptions.map(opt => opt.toLowerCase()));
      if (uniqueOptions.size !== cleanOptions.length) {
        throw new Error('Les options doivent être uniques');
      }

      // Appeler le réducteur create_vote avec la nouvelle API
      // Order: title, options, visibility, votingSystem
      const result = await spacetimeDB.call(
        'createVote',
        params.title.trim(),
        cleanOptions,
        params.visibility,
        params.votingSystem
      );

      // TODO: SpacetimeDB devrait retourner l'ID du vote créé
      // Pour l'instant, on simule un succès
      const success: CreateVoteResult = {
        voteId: 'temp-vote-id', // À remplacer par l'ID réel
        token: 'temp-token' // À remplacer par le token réel
      };

      setLastResult(success);
      return success;

    } catch (error) {
      console.error('Erreur lors de la création du vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
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
