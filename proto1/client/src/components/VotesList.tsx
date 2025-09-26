import { VoteWithOptions } from '../hooks/useVotes';

interface VotesListProps {
  votes: VoteWithOptions[];
  isLoading: boolean;
  error?: string | null;
  onVoteClick?: (vote: VoteWithOptions) => void; // clicking the card => usually "view"
  onVoteButtonClick?: (vote: VoteWithOptions) => void; // clicking the Vote button => usually "vote"
  emptyMessage?: string;
  onCreateClick?: () => void;
}

const VotesList: React.FC<VotesListProps> = ({
  votes,
  isLoading,
  error,
  onVoteClick,
  onVoteButtonClick,
  emptyMessage = "No votes found.",
  onCreateClick
}) => {

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">

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
          <div className="space-y-2">
            {votes.map((vote) => (
              <div
                key={vote.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Vote Title on Left */}
                <div 
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => onVoteClick?.(vote)}
                >
                  <h4 style={{ 
                    margin: 0, 
                    fontWeight: '500', 
                    color: '#111827', 
                    fontSize: '16px' 
                  }}>
                    {vote.title}
                  </h4>
                </div>

                {/* Vote Button on Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVoteButtonClick) onVoteButtonClick(vote);
                    else onVoteClick?.(vote);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    marginLeft: '16px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981';
                  }}
                >
                  Vote
                </button>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VotesList;
