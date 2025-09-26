import { VoteWithOptions } from '../hooks/useVotes';

interface VotesListProps {
  votes: VoteWithOptions[];
  isLoading: boolean;
  error?: string | null;
  onVoteClick?: (vote: VoteWithOptions) => void; // clicking the card => usually "view"
  onVoteButtonClick?: (vote: VoteWithOptions) => void; // clicking the Vote button => usually "vote"
  emptyMessage?: string;
}

const VotesList: React.FC<VotesListProps> = ({
  votes,
  isLoading,
  error,
  onVoteClick,
  onVoteButtonClick,
  emptyMessage = "No votes found."
}) => {

  return (
    <div id="votes-list-body" className="list-body">
      {isLoading ? (
        <div id="votes-list-loading" className="loading">
          <div id="votes-list-spinner" className="spinner"></div>
          <span id="votes-list-loading-text">Loading votes...</span>
        </div>
      ) : error ? (
        <div id="votes-list-error" className="error">
          <div id="votes-list-error-title" className="error-title">⚠️ Error</div>
          <p id="votes-list-error-text" className="error-text">{error}</p>
        </div>
      ) : votes.length === 0 ? (
        <div id="votes-list-empty" className="empty">
          <p id="votes-list-empty-text">{emptyMessage}</p>
        </div>
      ) : (
        <div id="votes-list-items" className="list-items">
          {votes.map((vote) => (
            <div
              key={vote.id}
              id={`vote-row-${vote.id}`}
              className="vote-row"
              onClick={() => onVoteClick?.(vote)}
            >
              {/* Vote Title on Left */}
              <div
                id={`vote-title-wrap-${vote.id}`}
                className="vote-title-wrap"
                onClick={() => onVoteClick?.(vote)}
              >
                <h4 id={`vote-title-${vote.id}`} className="vote-title">{vote.title}</h4>
              </div>

              {/* Vote Button on Right */}
              <button
                id={`vote-btn-${vote.id}`}
                className="vote-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onVoteButtonClick) onVoteButtonClick(vote);
                  else onVoteClick?.(vote);
                }}
              >
                Vote
              </button>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VotesList;
