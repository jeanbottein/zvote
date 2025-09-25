import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import CreateVoteForm from '../components/CreateVoteForm';
import { useCreateVote } from '../hooks/useCreateVote';

interface CreateVotePageProps {
  onNavigateHome?: () => void;
  onVoteCreated?: (voteId: string) => void;
}

const CreateVotePage: React.FC<CreateVotePageProps> = ({ 
  onNavigateHome, 
  onVoteCreated 
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { lastResult } = useCreateVote();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleVoteCreated = async (voteId: string) => {
    // Afficher un message de succès
    setShowSuccess(true);
    showToast({ type: 'success', message: 'Vote created successfully! 🎉' });
    
    // Appeler le callback parent si fourni
    if (onVoteCreated) {
      onVoteCreated(voteId);
    }
    
    // Retourner à l'accueil après un délai
    setTimeout(() => {
      if (onNavigateHome) onNavigateHome();
      else navigate('/');
    }, 2000);
  };

  const handleCancel = () => {
    if (onNavigateHome) onNavigateHome();
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Retour à l'accueil
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Créer un nouveau vote</h1>
          <p className="text-gray-600 mt-2">
            Configurez votre vote selon vos besoins et partagez-le avec vos participants.
          </p>
        </div>

        {/* Message de succès */}
        {showSuccess && lastResult && !lastResult.error && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Vote créé avec succès !</h3>
                <p className="text-sm text-green-700 mt-1">
                  Redirection vers votre vote en cours...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message d'erreur global */}
        {lastResult?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erreur lors de la création</h3>
                <p className="text-sm text-red-700 mt-1">{lastResult.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire de création */}
        <CreateVoteForm
          onVoteCreated={handleVoteCreated}
          onError={(msg) => showToast({ type: 'error', message: msg })}
          onCancel={handleCancel}
        />

        {/* Guide d'utilisation */}
        <div className="mt-12 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Guide des systèmes de vote
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">
                🗳️ Vote par approbation
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Chaque participant peut approuver ou rejeter chaque option. 
                L'option avec le plus d'approbations gagne.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Idéal pour :</strong>
                <ul className="mt-1 list-disc list-inside">
                  <li>Choix rapides et simples</li>
                  <li>Sélection multiple possible</li>
                  <li>Groupes nombreux</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border border-purple-200 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">
                ⚖️ Jugement majoritaire
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Chaque option reçoit une mention qualitative (Excellent, Bien, Passable, etc.). 
                L'option avec la meilleure mention majoritaire l'emporte.
              </p>
              <div className="text-sm text-gray-500">
                <strong>Idéal pour :</strong>
                <ul className="mt-1 list-disc list-inside">
                  <li>Décisions importantes</li>
                  <li>Évaluation qualitative</li>
                  <li>Choix nuancés</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Exemples d'utilisation */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            💡 Exemples d'utilisation
          </h3>
          
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-800 mb-1">Public</div>
              <div className="text-gray-600">
                Visible dans la liste publique, accessible à tous
              </div>
            </div>
            
            <div>
              <div className="font-medium text-gray-800 mb-1">Non-listé</div>
              <div className="text-gray-600">
                Accessible uniquement via le lien partagé
              </div>
            </div>
            
            <div>
              <div className="font-medium text-gray-800 mb-1">Privé</div>
              <div className="text-gray-600">
                Accès restreint aux personnes autorisées
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateVotePage;
