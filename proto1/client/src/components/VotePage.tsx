import React from 'react';
import { useParams } from 'react-router-dom';
import { VoteSubscriptionProvider, useVote } from './VoteSubscriptionProvider';

// Composant de chargement
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-lg">Chargement du vote...</span>
  </div>
);

// Composant d'erreur
const ErrorState: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
      <h2 className="text-lg font-semibold text-red-800 mb-2">Erreur</h2>
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  </div>
);

// État de connexion
const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
  if (isConnected) return null;
  
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            🔄 Connexion perdue. Tentative de reconnexion en cours...
          </p>
        </div>
      </div>
    </div>
  );
};

// Indicateur de mise à jour en temps réel
const LiveIndicator: React.FC<{ totalVoters: number }> = ({ totalVoters }) => (
  <div className="flex items-center space-x-2 text-sm text-gray-600">
    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
    <span>
      {totalVoters} participant{totalVoters > 1 ? 's' : ''} • Résultats en temps réel
    </span>
  </div>
);

// Contenu principal du vote
const VoteContent: React.FC = () => {
  const {
    vote,
    options,
    judgments,
    totalVoters,
    isLoading,
    error,
    userHasVoted,
    userJudgments,
    refetch
  } = useVote();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  if (!vote) {
    return <ErrorState error="Vote non trouvé" onRetry={refetch} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{vote.title}</h1>
        <div className="flex items-center justify-between">
          <LiveIndicator totalVoters={totalVoters} />
          <div className="text-sm text-gray-500">
            Jugement majoritaire • {vote.public ? 'Public' : 'Privé'}
          </div>
        </div>
      </header>

      {/* Status de connexion */}
      <ConnectionStatus isConnected={true} />

      {/* Placeholder pour les résultats et l'interface de vote */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {userHasVoted ? 'Résultats et votre vote' : 'Résultats actuels'}
        </h2>
        
        {/* Affichage des options */}
        <div className="space-y-4">
          {options.map((option) => (
            <div key={option.id} className="border rounded-lg p-4">
              <h3 className="font-medium text-lg mb-2">{option.label}</h3>
              
              {/* Placeholder pour la barre de résultats */}
              <div className="bg-gray-200 rounded-full h-6 mb-2">
                <div className="bg-blue-500 h-full rounded-full" style={{width: '60%'}}></div>
              </div>
              
              {/* Informations de debug */}
              <div className="text-sm text-gray-500">
                Jugements pour cette option: {judgments.filter(j => j.option_id === option.id).length}
                {userHasVoted && (
                  <span className="ml-4">
                    Votre choix: {userJudgments.find(j => j.option_id === option.id)?.mention || 'Non défini'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions utilisateur */}
        <div className="mt-6 flex space-x-4">
          {!userHasVoted ? (
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Voter maintenant
            </button>
          ) : (
            <>
              <button className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                Modifier mon vote
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Retirer mon vote
              </button>
            </>
          )}
          
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            Partager
          </button>
        </div>

        {/* Informations de debug */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <h4 className="font-medium mb-2">Debug Info:</h4>
          <p>Vote ID: {vote.id}</p>
          <p>Token: {vote.token}</p>
          <p>Options: {options.length}</p>
          <p>Total judgements: {judgments.length}</p>
          <p>Utilisateur a voté: {userHasVoted ? 'Oui' : 'Non'}</p>
          <p>Jugements utilisateur: {userJudgments.length}</p>
        </div>
      </div>
    </div>
  );
};

// Page principale
const VotePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <ErrorState
        error="Token de vote manquant dans l'URL"
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <VoteSubscriptionProvider token={token}>
      <VoteContent />
    </VoteSubscriptionProvider>
  );
};

export default VotePage;
