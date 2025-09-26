import React from 'react';
import { VoteWithOptions } from '../hooks/useVotes';

interface VoteWithSection extends VoteWithOptions {
  section: 'my' | 'public';
}

interface UnifiedVotesListProps {
  votes: VoteWithSection[];
  isLoading: boolean;
  error?: string | null;
  onVoteClick?: (vote: VoteWithOptions) => void;
  onVoteButtonClick?: (vote: VoteWithOptions) => void;
}

const UnifiedVotesList: React.FC<UnifiedVotesListProps> = ({
  votes,
  isLoading,
  error,
  onVoteClick,
  onVoteButtonClick,
}) => {
  const getVisibilityColor = (vote: VoteWithOptions) => {
    const vtag = ((vote as any).visibility?.tag ?? ((vote as any).public ? 'Public' : 'Private')) as string;
    switch (vtag) {
      case 'Public': return '#3b82f6'; // Blue
      case 'Unlisted': return '#8b5cf6'; // Violet
      case 'Private': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray fallback
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading votes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">⚠️ Error</div>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No votes found.</p>
      </div>
    );
  }

  // Group votes by section
  const myVotes = votes.filter(vote => vote.section === 'my');
  const publicVotes = votes.filter(vote => vote.section === 'public');

  return (
    <div className="space-y-6">
      {/* My Votes Section */}
      {myVotes.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">My Votes</h3>
          <div className="space-y-2">
            {myVotes.map((vote) => (
              <div
                key={vote.id}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                style={{ minHeight: '60px' }}
              >
                {/* Vote Button on Left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVoteButtonClick) onVoteButtonClick(vote);
                    else onVoteClick?.(vote);
                  }}
                  className="flex-shrink-0 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors mr-4"
                >
                  Vote
                </button>

                {/* Vote Title and Info */}
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onVoteClick?.(vote)}
                >
                  <h4 className="font-medium text-gray-900 text-base">{vote.title}</h4>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-xs text-gray-500">
                      {vote.options?.length || 0} options
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {typeof vote.voting_system === 'string' ? vote.voting_system : vote.voting_system?.tag}
                    </span>
                  </div>
                </div>

                {/* Visibility Indicator on Right */}
                <div
                  className="flex-shrink-0 w-4 h-4 rounded-full ml-4"
                  style={{ backgroundColor: getVisibilityColor(vote) }}
                  title={((vote as any).visibility?.tag ?? ((vote as any).public ? 'Public' : 'Private')) as string}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Votes Section */}
      {publicVotes.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">Public Votes</h3>
          <div className="space-y-2">
            {publicVotes.map((vote) => (
              <div
                key={vote.id}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                style={{ minHeight: '60px' }}
              >
                {/* Vote Button on Left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVoteButtonClick) onVoteButtonClick(vote);
                    else onVoteClick?.(vote);
                  }}
                  className="flex-shrink-0 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors mr-4"
                >
                  Vote
                </button>

                {/* Vote Title and Info */}
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onVoteClick?.(vote)}
                >
                  <h4 className="font-medium text-gray-900 text-base">{vote.title}</h4>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-xs text-gray-500">
                      {vote.options?.length || 0} options
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {typeof vote.voting_system === 'string' ? vote.voting_system : vote.voting_system?.tag}
                    </span>
                  </div>
                </div>

                {/* Visibility Indicator on Right */}
                <div
                  className="flex-shrink-0 w-4 h-4 rounded-full ml-4"
                  style={{ backgroundColor: getVisibilityColor(vote) }}
                  title={((vote as any).visibility?.tag ?? ((vote as any).public ? 'Public' : 'Private')) as string}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedVotesList;
