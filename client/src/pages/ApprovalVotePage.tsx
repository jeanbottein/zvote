import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import BallotInterface from '../features/BallotInterface/BallotInterface';
import ApprovalResultsDisplay from '../features/VotingSystem/ApprovalVoting/ApprovalResultsDisplay';
import { useToast } from '../components/ToastProvider';
import DeleteVoteButton from '../components/DeleteVoteButton';

const ApprovalVotePage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);
  const { showToast } = useToast();

  useEffect(() => {
    if (token) {
      console.log('[ApprovalVotePage] Setting up focused subscription for token:', token);
      // Wait for connection and initial subscriptions before applying focused ones
      const tryFocus = async () => {
        if (spacetimeDB.connection && spacetimeDB.subscriptionsApplied) {
          console.log('[ApprovalVotePage] Applying focused subscription now');
          try {
            await spacetimeDB.setFocusedVoteByToken(token);
            console.log('[ApprovalVotePage] Focused subscription completed successfully');
          } catch (e) {
            console.error('[ApprovalVotePage] Focused subscription failed:', e);
          }
        } else {
          console.log('[ApprovalVotePage] Waiting for connection/subscriptions...', {
            connected: !!spacetimeDB.connection,
            subsApplied: spacetimeDB.subscriptionsApplied
          });
          setTimeout(tryFocus, 100);
        }
      };
      tryFocus();
    }
  }, [token]);

  if (!token) {
    return <div className="panel"><h2>Missing token</h2></div>;
  }
  if (loading) {
    return <div className="panel"><h2>Loading vote…</h2></div>;
  }
  if (error) {
    return <div className="panel"><h2>Error</h2><div style={{color:'var(--muted)'}}>{error}</div></div>;
  }
  if (!vote) {
    return <div className="panel"><h2>Vote not found</h2></div>;
  }

  const totalVoters = Math.max(...(vote.options || []).map(o => o.approvals_count || 0), 0);

  return (
    <>
      {/* Ballot section - outside panel */}
      <BallotInterface 
        vote={vote}
        onBallotSubmitted={() => {}} // No success toast
        onError={(msg: string) => showToast({ type: 'error', message: msg })}
      />

      {/* Results section - in panel */}
      <div className="panel">
        <div className="vote-page-header">
          <h3 style={{ marginBottom: '16px' }}>Results for {vote.title}</h3>
          <div className="ballot-count-badge">
            <span className="ballot-count-number">{totalVoters}</span>
            <span className="ballot-count-label">{totalVoters === 1 ? 'ballot' : 'ballots'}</span>
          </div>
        </div>
        {(vote.options || []).map((option) => (
          <ApprovalResultsDisplay
            key={option.id}
            optionLabel={option.label}
            approvalsCount={option.approvals_count || 0}
            totalBallots={totalVoters}
            compact={false}
          />
        ))}

        <DeleteVoteButton
          voteId={vote.id}
          voteCreator={vote.creator}
          voteTitle={vote.title}
        />
      </div>
    </>
  );
};

export default ApprovalVotePage;
