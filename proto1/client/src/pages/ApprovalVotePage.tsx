import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import ApprovalVotingDisplay from '../components/ApprovalVotingDisplay';
import VotingInterface from '../components/VotingInterface';
import { useToast } from '../components/ToastProvider';

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
    <div className="panel">
      <h2>{vote.title}</h2>
      <div style={{ marginTop: '16px' }}>
        {(vote.options || []).map((option) => (
          <ApprovalVotingDisplay
            key={option.id}
            optionLabel={option.label}
            approvalsCount={option.approvals_count || 0}
            totalVoters={totalVoters}
            compact={false}
          />
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        <VotingInterface 
          vote={vote}
          onVoteCast={() => showToast({ type: 'success', message: 'Vote cast successfully! ✅' })}
          onError={(msg) => showToast({ type: 'error', message: msg })}
        />
      </div>
    </div>
  );
};

export default ApprovalVotePage;
