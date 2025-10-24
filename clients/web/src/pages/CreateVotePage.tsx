import React from 'react';
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

  const handleVoteCreated = async (voteId: string) => {
    // Call parent callback if provided
    if (onVoteCreated) {
      onVoteCreated(voteId);
    }
    
    // Navigate immediately on success (no toast, no delay)
    if (onNavigateHome) onNavigateHome();
    else navigate('/');
  };


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
        </div>


        {/* Error message */}
        {lastResult?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error creating vote</h3>
                <p className="text-sm text-red-700 mt-1">{lastResult.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create vote form */}
        <CreateVoteForm
          onVoteCreated={handleVoteCreated}
          onError={(msg) => showToast({ type: 'error', message: msg })}
        />
      </div>
    </div>
  );
};

export default CreateVotePage;
