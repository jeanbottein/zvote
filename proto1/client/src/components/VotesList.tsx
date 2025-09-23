import { VoteWithOptions } from '../hooks/useVotes';

interface VotesListProps {
  votes: VoteWithOptions[];
  title: string;
  isLoading: boolean;
  error?: string | null;
  onVoteClick?: (vote: VoteWithOptions) => void;
  emptyMessage?: string;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

const VotesList: React.FC<VotesListProps> = ({
  votes,
  title,
  isLoading,
  error,
  onVoteClick,
  emptyMessage = "No votes found.",
  showCreateButton = false,
  onCreateClick
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVotingSystemLabel = (system: any) => {
    // Handle both old string format and new tagged union format
    const systemTag = typeof system === 'string' ? system : system?.tag;
    
    switch (systemTag) {
      case 'Approval':
        return '🗳️ Approbation';
      case 'MajorityJudgment':
        return '⚖️ Jugement majoritaire';
      default:
        return systemTag || 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {showCreateButton && (
            <button
              onClick={onCreateClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Create vote
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading votes...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-2">⚠️ Error</div>
            <p className="text-gray-600">{error}</p>
          </div>
        ) : votes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">📊</div>
            <p className="text-gray-600">{emptyMessage}</p>
            {showCreateButton && (
              <button
                onClick={onCreateClick}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Create your first vote
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {votes.map((vote) => (
              <div
                key={vote.id}
                onClick={() => onVoteClick?.(vote)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900 text-lg">{vote.title}</h3>
                  <div className="flex items-center space-x-2">
                    {vote.public ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Public
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        Private
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <span>{getVotingSystemLabel(vote.voting_system)}</span>
                  <span>{formatDate(vote.created_at)}</span>
                </div>

                {vote.options && vote.options.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 mb-1">
                      Options ({vote.options.length}):
                    </div>
                    {vote.options.slice(0, 3).map((option) => (
                      <div key={option.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 truncate">{option.label}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {option.approvals_count} votes
                        </span>
                      </div>
                    ))}
                    {vote.options.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{vote.options.length - 3} more options
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotesList;
