import { useEffect, useState } from 'react';
import Header from './components/Header';
import Modal from './components/Modal';
import CreateVoteForm from './components/CreateVoteForm';
import VotingInterface from './components/VotingInterface';
import ApprovalVotingDisplay from './components/ApprovalVotingDisplay';
import MajorityJudgmentGraph from './components/MajorityJudgmentGraph';
import { useVotes, VoteWithOptions } from './hooks/useVotes';
import { VotingSystem } from './generated/voting_system_type';

// Helper function to get display name from VotingSystem tagged union
const getVotingSystemDisplayName = (votingSystem: VotingSystem): string => {
  return votingSystem.tag;
};

// Helper function to get visibility display name from Visibility tagged union
const getVisibilityDisplayName = (vote: VoteWithOptions): string => {
  if (vote.visibility?.tag) {
    return vote.visibility.tag;
  }
  // Fallback to the boolean field for backward compatibility
  return vote.public ? 'Public' : 'Private';
};

// Helper function to get badge styling based on visibility
const getVisibilityBadgeStyle = (vote: VoteWithOptions): React.CSSProperties => {
  const visibility = vote.visibility?.tag || (vote.public ? 'Public' : 'Private');
  
  switch (visibility) {
    case 'Public':
      return { backgroundColor: '#15803d', color: 'white' }; // Green
    case 'Unlisted':
      return { backgroundColor: '#b45309', color: 'white' }; // Orange
    case 'Private':
      return { backgroundColor: '#dc2626', color: 'white' }; // Red
    default:
      return {};
  }
};

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'vote'>('home');
  const [selectedVote, setSelectedVote] = useState<VoteWithOptions | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { myVotes, publicVotes, isLoading, error, refreshVotes } = useVotes();

  // Keep selectedVote fresh as live data updates come in
  useEffect(() => {
    if (!selectedVote) return;
    const updated = [...myVotes, ...publicVotes].find(v => v.id === selectedVote.id);
    if (updated) {
      setSelectedVote(updated);
    }
  }, [myVotes, publicVotes, selectedVote?.id]);

  const handleVoteCreated = (voteId: string) => {
    console.log('Vote créé avec l\'ID:', voteId);
    setNotification({ message: 'Vote created successfully! 🎉', type: 'success' });
    setShowCreateModal(false);
    
    // SpacetimeDB subscriptions should handle the real-time updates automatically
    // But we'll keep a small fallback refresh just in case
    setTimeout(() => {
      refreshVotes();
    }, 500); // Fallback refresh
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleVoteError = (error: string) => {
    console.error('Vote creation error:', error);
    setNotification({ message: error, type: 'error' });
    
    // Auto-hide notification after 5 seconds (longer for errors)
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleVoteCast = () => {
    setNotification({ message: 'Vote cast successfully! ✅', type: 'success' });
    
    // Refresh votes to show updated counts
    setTimeout(() => {
      refreshVotes();
    }, 200);
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleVotingError = (error: string) => {
    setNotification({ message: error, type: 'error' });
    
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleVoteClick = (vote: VoteWithOptions) => {
    setSelectedVote(vote);
    setCurrentView('vote');
  };

  const handleViewChange = (view: 'home' | 'create' | 'vote') => {
    if (view === 'create') {
      setShowCreateModal(true);
    } else {
      setCurrentView(view as 'home' | 'vote');
    }
  };

  // Show vote detail page (placeholder for now)
  if (currentView === 'vote' && selectedVote) {
    return (
      <>
        <Header onViewChange={handleViewChange} currentView={currentView} />
        <main>
          <div className="panel">
            <button
              onClick={() => setCurrentView('home')}
              className="secondary"
              style={{ marginBottom: '16px' }}
            >
              ← Back to votes
            </button>
            <h2>{selectedVote.title}</h2>
            <p>Voting system: {getVotingSystemDisplayName(selectedVote.voting_system)}</p>
            <p>Visibility: {getVisibilityDisplayName(selectedVote)}</p>
            
            {/* Vote Results */}
            <div style={{ marginTop: '16px' }}>
              <h3>Current Results:</h3>
              
              {getVotingSystemDisplayName(selectedVote.voting_system) === 'Approval' && (
                <div>
                  {selectedVote.options?.map((option) => {
                    const totalVoters = selectedVote.options?.reduce((sum, opt) => 
                      Math.max(sum, opt.approvals_count || 0), 0) || option.approvals_count || 0;
                    
                    return (
                      <ApprovalVotingDisplay
                        key={option.id}
                        optionLabel={option.label}
                        approvalsCount={option.approvals_count || 0}
                        totalVoters={totalVoters}
                        compact={false}
                      />
                    );
                  })}
                </div>
              )}

              {getVotingSystemDisplayName(selectedVote.voting_system) === 'MajorityJudgment' && (
                <div>
                  {selectedVote.options?.map((option) => {
                    const judgmentCounts = option.judgment_counts || {
                      ToReject: 0,
                      Passable: 0,
                      Good: 0,
                      VeryGood: 0,
                      Excellent: 0
                    };
                    const totalJudgments = option.total_judgments || 0;
                    
                    return (
                      <MajorityJudgmentGraph
                        key={option.id}
                        optionLabel={option.label}
                        judgmentCounts={judgmentCounts}
                        totalJudgments={totalJudgments}
                        compact={false}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Voting Interface */}
            <VotingInterface 
              vote={selectedVote}
              onVoteCast={handleVoteCast}
              onError={handleVotingError}
            />
          </div>
        </main>
      </>
    );
  }

  // Show home page with votes lists using original layout
  return (
    <>
      <Header onViewChange={handleViewChange} currentView={currentView} />
      
      <main>
        {/* My Votes */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>My votes</h2>
            <button onClick={() => setShowCreateModal(true)}>
              + Create vote
            </button>
          </div>
          
          {isLoading ? (
            <div>Loading votes...</div>
          ) : error ? (
            <div style={{ color: 'var(--muted)' }}>{error}</div>
          ) : myVotes.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>
              <p>You haven't created any votes yet.</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: '8px' }}
              >
                Create your first vote
              </button>
            </div>
          ) : (
            <ul className="list">
              {myVotes.map((vote) => (
                <li key={vote.id} style={{ cursor: 'pointer' }}>
                  <div onClick={() => handleVoteClick(vote)} style={{ flex: 1 }}>
                    <strong>{vote.title}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {getVotingSystemDisplayName(vote.voting_system)} • {vote.options?.length || 0} options
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoteClick(vote);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--accent-solid)',
                        color: '#0b0b0b',
                        cursor: 'pointer'
                      }}
                    >
                      Vote
                    </button>
                    <div className="badge" style={getVisibilityBadgeStyle(vote)}>
                      {getVisibilityDisplayName(vote)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Public Votes */}
        <div className="panel">
          <h2>Public votes</h2>
          
          {isLoading ? (
            <div>Loading votes...</div>
          ) : error ? (
            <div style={{ color: 'var(--muted)' }}>{error}</div>
          ) : publicVotes.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>
              No public votes available.
            </div>
          ) : (
            <ul className="list">
              {publicVotes.map((vote) => (
                <li key={vote.id} style={{ cursor: 'pointer' }}>
                  <div onClick={() => handleVoteClick(vote)} style={{ flex: 1 }}>
                    <strong>{vote.title}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {getVotingSystemDisplayName(vote.voting_system)} • {vote.options?.length || 0} options
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoteClick(vote);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--accent-solid)',
                        color: '#0b0b0b',
                        cursor: 'pointer'
                      }}
                    >
                      Vote
                    </button>
                    <div className="badge">Public</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Success/Error Notification */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: notification.type === 'success' ? '#4ade80' : '#ef4444',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            animation: 'slideInRight 0.3s ease-out',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '400px'
          }}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '2px',
              lineHeight: 1,
              opacity: 0.8
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Create Vote Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        title="Create a vote"
      >
        <CreateVoteForm
          onVoteCreated={handleVoteCreated}
          onError={handleVoteError}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </>
  );
}

export default App;
