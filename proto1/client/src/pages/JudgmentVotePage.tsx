import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import MajorityJudgmentGraph from '../components/MajorityJudgmentGraph';
import VotingInterface from '../components/VotingInterface';
import { useToast } from '../components/ToastProvider';

const JudgmentVotePage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);
  const { showToast } = useToast();

  useEffect(() => {
    if (token) {
      spacetimeDB.setFocusedVoteByToken(token).catch(console.warn);
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

  return (
    <div className="panel">
      <h2>{vote.title}</h2>
      <div style={{ marginTop: '16px' }}>
        {(vote.options || []).map((option) => (
          <MajorityJudgmentGraph
            key={option.id}
            optionLabel={option.label}
            judgmentCounts={option.judgment_counts || { ToReject: 0, Passable: 0, Good: 0, VeryGood: 0, Excellent: 0 }}
            totalJudgments={option.total_judgments || 0}
            majorityTag={option.majority_tag}
            secondTag={option.second_tag}
            compact={false}
          />
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        <VotingInterface 
          vote={vote}
          onVoteCast={() => showToast({ type: 'success', message: 'Judgment recorded! ✅' })}
          onError={(msg) => showToast({ type: 'error', message: msg })}
        />
      </div>
    </div>
  );
};

export default JudgmentVotePage;
