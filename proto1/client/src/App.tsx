import { useEffect, useState } from 'react';
import Header from './components/Header';
import Modal from './components/Modal';
import CreateVoteForm from './components/CreateVoteForm';
import VotingInterface from './components/VotingInterface';
import ApprovalVotingDisplay from './components/ApprovalVotingDisplay';
import MajorityJudgmentGraph from './components/MajorityJudgmentGraph';
import { useVotes, VoteWithOptions } from './hooks/useVotes';
import { VotingSystem } from './generated/voting_system_type';
import { spacetimeDB } from './lib/spacetimeClient';

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

  // Helpers: URL token management (path-based: /vote/<token>)
  const getTokenFromUrl = (): string | null => {
    try {
      const path = window.location.pathname || '/';
      const m = path.match(/^\/vote\/([^/]+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch {
      return null;
    }
  };

  const pushTokenToUrl = (token: string | null) => {
    const base = `${window.location.origin}`;
    const newUrl = token ? `${base}/vote/${encodeURIComponent(token)}` : `${base}/`;
    window.history.pushState({}, '', newUrl);
  };

  const findVoteByToken = (token: string | null): VoteWithOptions | undefined => {
    if (!token) return undefined;
    return [...myVotes, ...publicVotes].find(v => v.token === token);
  };

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
    // Update URL and focus subscriptions
    if (vote.token) pushTokenToUrl(vote.token);
    spacetimeDB.setFocusedVote(vote.id).catch(console.warn);
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedVote(null);
    pushTokenToUrl(null);
    spacetimeDB.setFocusedVote(null).catch(console.warn);
    // Reconnect to restore wide subscriptions so public list appears
    spacetimeDB.refocus();
  };

  const handleViewChange = (view: 'home' | 'create' | 'vote') => {
    if (view === 'create') {
      setShowCreateModal(true);
    } else if (view === 'home') {
      // Route all 'home' navigations through the same cleanup logic
      handleBackToHome();
    } else {
      setCurrentView(view as 'home' | 'vote');
    }
  };

  // Open vote from URL token on load or navigation
  useEffect(() => {
    const tryOpenFromUrl = () => {
      // Only attempt if we aren't already showing a vote
      if (selectedVote || currentView === 'vote') return;
      const token = getTokenFromUrl();
      if (!token) {
        // No token: ensure we are on home
        return;
      }
      const found = findVoteByToken(token);
      if (found) {
        setSelectedVote(found);
        setCurrentView('vote');
        spacetimeDB.setFocusedVote(found.id).catch(console.warn);
      }
    };

    // Try now (after votes load as well)
    tryOpenFromUrl();
    // Also on popstate (back/forward)
    const onPop = () => {
      const token = getTokenFromUrl();
      if (!token) {
        // Back to list
        setSelectedVote(null);
        setCurrentView('home');
        spacetimeDB.setFocusedVote(null).catch(console.warn);
        // Ensure wide subscriptions are active after back navigation
        spacetimeDB.refocus();
      } else {
        const found = findVoteByToken(token);
        if (found) {
          setSelectedVote(found);
          setCurrentView('vote');
          spacetimeDB.setFocusedVote(found.id).catch(console.warn);
        }
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [myVotes, publicVotes, selectedVote, currentView]);

  // Show vote detail page
  if (currentView === 'vote' && selectedVote) {
    return (
      <>
        <Header onViewChange={handleViewChange} currentView={currentView} />
        <main>
          <div className="panel">
            <button
              onClick={handleBackToHome}
              className="secondary"
              style={{ marginBottom: '16px' }}
            >
              ← Back to votes
            </button>
            <h2>{selectedVote.title}</h2>
            
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
                  {(() => {
                    // Sort options by majority mention (best to lowest)
                    const mentionOrder: Record<string, number> = {
                      ToReject: 1,
                      Passable: 2,
                      Good: 3,
                      VeryGood: 4,
                      Excellent: 5,
                    };
                    const computeMajorityMention = (counts?: Record<string, number>, total?: number) => {
                      const c = counts || { ToReject: 0, Passable: 0, Good: 0, VeryGood: 0, Excellent: 0 } as Record<string, number>;
                      const t = total || 0;
                      if (t <= 0) return null;
                      const expanded = Object.entries(c).flatMap(([m, n]) => Array(n).fill(m)).sort((a, b) => mentionOrder[a] - mentionOrder[b]);
                      const medianIdx = Math.floor(expanded.length / 2);
                      return expanded[medianIdx] || null;
                    };
                    const sorted = [...(selectedVote.options || [])].sort((a, b) => {
                      const ma = computeMajorityMention(a.judgment_counts as any, a.total_judgments);
                      const mb = computeMajorityMention(b.judgment_counts as any, b.total_judgments);
                      const ra = ma ? mentionOrder[ma] : 0;
                      const rb = mb ? mentionOrder[mb] : 0;
                      return rb - ra;
                    });
                    return sorted.map((option) => {
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
                    });
                  })()}
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
