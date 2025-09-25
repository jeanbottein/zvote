import { VoteWithOptions } from '../hooks/useVotes';

interface VotesListProps {
  votes: VoteWithOptions[];
  title: string;
  isLoading: boolean;
  error?: string | null;
  onVoteClick?: (vote: VoteWithOptions) => void; // clicking the card => usually "view"
  onVoteButtonClick?: (vote: VoteWithOptions) => void; // clicking the Vote button => usually "vote"
  emptyMessage?: string;
  onCreateClick?: () => void;
}

const VotesList: React.FC<VotesListProps> = ({
  votes,
  title,
  isLoading,
  error,
  onVoteClick,
  onVoteButtonClick,
  emptyMessage = "No votes found.",
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
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
            <p className="text-gray-600">{emptyMessage}</p>
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
                    {(() => {
                      const vtag = ((vote as any).visibility?.tag ?? ((vote as any).public ? 'Public' : 'Private')) as string;
                      const cls = vtag === 'Public'
                        ? 'bg-green-100 text-green-800'
                        : vtag === 'Unlisted'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800';
                      return (
                        <span className={`px-2 py-1 ${cls} text-xs rounded-full`}>
                          {vtag}
                        </span>
                      );
                    })()}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onVoteButtonClick) onVoteButtonClick(vote);
                        else onVoteClick?.(vote);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        backgroundColor: '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Vote
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotesList;
