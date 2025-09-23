import React, { createContext, useContext, ReactNode } from 'react';
import { useVoteSubscription } from '../hooks/useVoteSubscription';
import { useVoteActions } from '../hooks/useVoteActions';
import { VoteResults, Judgment } from '../types/spacetime';

interface VoteContextValue extends VoteResults {
  userHasVoted: boolean;
  userJudgments: Judgment[];
  refetch: () => void;
  cleanup: () => void;
  castJudgment: (optionId: string, mention: any) => Promise<void>;
  withdrawVote: (voteId: string) => Promise<void>;
  actionsLoading: boolean;
  actionsError: string | null;
}

const VoteContext = createContext<VoteContextValue | null>(null);

interface VoteSubscriptionProviderProps {
  children: ReactNode;
  voteId?: string;
  token?: string;
}

export const VoteSubscriptionProvider: React.FC<VoteSubscriptionProviderProps> = ({ 
  children, 
  voteId, 
  token 
}) => {
  const subscriptionData = useVoteSubscription({ voteId, token });
  const { castJudgment, withdrawVote, isLoading: actionsLoading, error: actionsError } = useVoteActions();

  const contextValue: VoteContextValue = {
    ...subscriptionData,
    castJudgment,
    withdrawVote,
    actionsLoading,
    actionsError
  };

  return (
    <VoteContext.Provider value={contextValue}>
      {children}
    </VoteContext.Provider>
  );
};

export const useVoteContext = (): VoteContextValue => {
  const context = useContext(VoteContext);
  if (!context) {
    throw new Error('useVoteContext must be used within a VoteSubscriptionProvider');
  }
  return context;
};

// Hook pour faciliter l'utilisation dans les composants
export const useVote = () => {
  const context = useVoteContext();
  
  return {
    // Données du vote
    vote: context.vote,
    options: context.options,
    judgments: context.judgments,
    totalVoters: context.totalVoters,
    
    // État de chargement et erreurs
    isLoading: context.isLoading,
    error: context.error,
    
    // État utilisateur
    userHasVoted: context.userHasVoted,
    userJudgments: context.userJudgments,
    
    // Actions
    castJudgment: context.castJudgment,
    withdrawVote: context.withdrawVote,
    actionsLoading: context.actionsLoading,
    actionsError: context.actionsError,
    
    // Utilitaires
    refetch: context.refetch,
    cleanup: context.cleanup
  };
};
