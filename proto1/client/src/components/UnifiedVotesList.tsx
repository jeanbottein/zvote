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
  const getVisibilityTag = (vote: VoteWithOptions): 'Public' | 'Unlisted' | 'Private' | 'Unknown' => {
    const vtag = ((vote as any).visibility?.tag ?? ((vote as any).public ? 'Public' : 'Private')) as string;
    if (vtag === 'Public' || vtag === 'Unlisted' || vtag === 'Private') return vtag;
    return 'Unknown';
  };


  if (isLoading) {
    return (
      <div id="uvl-loading" className="loading">
        <div id="uvl-spinner" className="spinner"></div>
        <span id="uvl-loading-text">Loading votes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div id="uvl-error" className="error">
        <div id="uvl-error-title" className="error-title">⚠️ Error</div>
        <p id="uvl-error-text" className="error-text">{error}</p>
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div id="uvl-empty" className="empty">
        <p id="uvl-empty-text">No votes found.</p>
      </div>
    );
  }

  // Group votes by section
  const myVotes = votes.filter(vote => vote.section === 'my');
  const publicVotes = votes.filter(vote => vote.section === 'public');

  return (
    <div id="uvl" className="votes-sections">
      {/* My Votes Section */}
      {myVotes.length > 0 && (
        <section id="uvl-section-my" className="votes-section">
          <h3 id="uvl-title-my" className="votes-section-title">My Votes</h3>
          <div id="uvl-items-my" className="uvl-items">
            {myVotes.map((vote) => (
              <div
                key={vote.id}
                id={`uvl-row-${vote.id}`}
                className="uvl-row"
                onClick={() => onVoteClick?.(vote)}
              >
                <button
                  id={`uvl-vote-btn-${vote.id}`}
                  className="uvl-vote-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVoteButtonClick) onVoteButtonClick(vote);
                    else onVoteClick?.(vote);
                  }}
                >
                  Vote
                </button>

                <div 
                  id={`uvl-title-wrap-${vote.id}`}
                  className="uvl-title-wrap"
                  onClick={() => onVoteClick?.(vote)}
                >
                  <h4 id={`uvl-title-${vote.id}`} className="uvl-title">{vote.title}</h4>
                </div>

                <div
                  id={`uvl-vis-${vote.id}`}
                  className="uvl-visibility-dot"
                  data-visibility={getVisibilityTag(vote)}
                  title={getVisibilityTag(vote)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Public Votes Section */}
      {publicVotes.length > 0 && (
        <section id="uvl-section-public" className="votes-section">
          <h3 id="uvl-title-public" className="votes-section-title">Public Votes</h3>
          <div id="uvl-items-public" className="uvl-items">
            {publicVotes.map((vote) => (
              <div
                key={vote.id}
                id={`uvl-row-public-${vote.id}`}
                className="uvl-row"
                onClick={() => onVoteClick?.(vote)}
              >
                <button
                  id={`uvl-vote-btn-public-${vote.id}`}
                  className="uvl-vote-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVoteButtonClick) onVoteButtonClick(vote);
                    else onVoteClick?.(vote);
                  }}
                >
                  Vote
                </button>

                <div 
                  id={`uvl-title-wrap-public-${vote.id}`}
                  className="uvl-title-wrap"
                  onClick={() => onVoteClick?.(vote)}
                >
                  <h4 id={`uvl-title-public-${vote.id}`} className="uvl-title">{vote.title}</h4>
                </div>

                <div
                  id={`uvl-vis-public-${vote.id}`}
                  className="uvl-visibility-dot"
                  data-visibility={getVisibilityTag(vote)}
                  title={getVisibilityTag(vote)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UnifiedVotesList;
