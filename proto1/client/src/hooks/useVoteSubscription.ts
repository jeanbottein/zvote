import { useState, useEffect, useCallback, useMemo } from 'react';
import { Vote, VoteOption, Judgment, VoteResults, VotingSystem } from '../types/spacetime';
import { spacetimeDB } from '../lib/spacetimeClient'; // Assumé existant

interface UseVoteSubscriptionOptions {
  voteId?: string;
  token?: string; // Alternative si on veut chercher par token
}

export const useVoteSubscription = ({ voteId, token }: UseVoteSubscriptionOptions) => {
  const [voteResults, setVoteResults] = useState<VoteResults>({
    vote: null as any,
    options: [],
    judgments: [],
    totalVoters: 0,
    isLoading: true,
    error: null,
  });

  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  // Fonction pour nettoyer les abonnements
  const cleanup = useCallback(() => {
    subscriptions.forEach(subId => {
      spacetimeDB.unsubscribe(subId);
    });
    setSubscriptions([]);
  }, [subscriptions]);

  // Fonction pour s'abonner aux tables nécessaires
  const subscribeToVote = useCallback(async (targetVoteId: string) => {
    try {
      setVoteResults(prev => ({ ...prev, isLoading: true, error: null }));

      const newSubscriptions: string[] = [];

      // 1. S'abonner à la table Vote pour récupérer les détails du vote
      const voteSubId = await spacetimeDB.subscribe(
        'SELECT * FROM vote WHERE id = ?',
        [targetVoteId],
        (vote: Vote) => {
          setVoteResults(prev => ({
            ...prev,
            vote,
            // Vérifier que c'est bien un vote par jugement majoritaire
            error: vote.voting_system !== VotingSystem.MajorityJudgment 
              ? 'Ce vote n\'utilise pas le jugement majoritaire' 
              : null
          }));
        }
      );
      newSubscriptions.push(voteSubId);

      // 2. S'abonner à la table VoteOption pour les options du vote
      const optionsSubId = await spacetimeDB.subscribe(
        'SELECT * FROM vote_option WHERE vote_id = ? ORDER BY order_index',
        [targetVoteId],
        (options: VoteOption[]) => {
          setVoteResults(prev => ({
            ...prev,
            options: options.sort((a, b) => a.order_index - b.order_index)
          }));
        }
      );
      newSubscriptions.push(optionsSubId);

      // 3. S'abonner à la table Judgment pour tous les jugements du vote
      const judgmentsSubId = await spacetimeDB.subscribe(
        `SELECT j.* FROM judgment j 
         INNER JOIN vote_option vo ON j.option_id = vo.id 
         WHERE vo.vote_id = ?`,
        [targetVoteId],
        (judgments: Judgment[]) => {
          // Calculer le nombre total de votants uniques
          const uniqueVoters = new Set(judgments.map(j => j.voter)).size;
          
          setVoteResults(prev => ({
            ...prev,
            judgments,
            totalVoters: uniqueVoters,
            isLoading: false
          }));
        }
      );
      newSubscriptions.push(judgmentsSubId);

      setSubscriptions(newSubscriptions);

    } catch (error) {
      console.error('Erreur lors de l\'abonnement au vote:', error);
      setVoteResults(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }));
    }
  }, []);

  // Fonction pour chercher un vote par token
  const subscribeByToken = useCallback(async (voteToken: string) => {
    try {
      setVoteResults(prev => ({ ...prev, isLoading: true, error: null }));

      // D'abord, chercher le vote par token
      const vote = await spacetimeDB.query('SELECT * FROM vote WHERE token = ?', [voteToken]);
      
      if (!vote || vote.length === 0) {
        throw new Error('Vote non trouvé avec ce token');
      }

      const foundVote = vote[0] as Vote;
      await subscribeToVote(foundVote.id);

    } catch (error) {
      console.error('Erreur lors de la recherche par token:', error);
      setVoteResults(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Vote non trouvé'
      }));
    }
  }, [subscribeToVote]);

  // Effet principal pour initialiser les abonnements
  useEffect(() => {
    if (voteId) {
      subscribeToVote(voteId);
    } else if (token) {
      subscribeByToken(token);
    }

    // Cleanup lors du démontage
    return cleanup;
  }, [voteId, token, subscribeToVote, subscribeByToken, cleanup]);

  // Effet pour gérer les déconnexions/reconnexions
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      if (!connected) {
        setVoteResults(prev => ({
          ...prev,
          error: 'Connexion perdue. Tentative de reconnexion...'
        }));
      } else if (voteId || token) {
        // Reconnexion : relancer les abonnements
        cleanup();
        if (voteId) {
          subscribeToVote(voteId);
        } else if (token) {
          subscribeByToken(token);
        }
      }
    };

    spacetimeDB.onConnectionChange(handleConnectionChange);

    return () => {
      spacetimeDB.offConnectionChange(handleConnectionChange);
    };
  }, [voteId, token, subscribeToVote, subscribeByToken, cleanup]);

  // Fonctions utilitaires
  const refetch = useCallback(() => {
    if (voteId) {
      cleanup();
      subscribeToVote(voteId);
    } else if (token) {
      cleanup();
      subscribeByToken(token);
    }
  }, [voteId, token, cleanup, subscribeToVote, subscribeByToken]);

  // Vérifier si l'utilisateur actuel a voté
  const userHasVoted = useMemo(() => {
    if (!spacetimeDB.currentUser || !voteResults.judgments.length) {
      return false;
    }
    return voteResults.judgments.some(j => j.voter === spacetimeDB.currentUser.identity);
  }, [voteResults.judgments]);

  // Récupérer les jugements de l'utilisateur actuel
  const userJudgments = useMemo(() => {
    if (!spacetimeDB.currentUser || !voteResults.judgments.length) {
      return [];
    }
    return voteResults.judgments.filter(j => j.voter === spacetimeDB.currentUser.identity);
  }, [voteResults.judgments]);

  return {
    ...voteResults,
    userHasVoted,
    userJudgments,
    refetch,
    cleanup
  };
};
