import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import MajorityJudgmentGraph from '../components/MajorityJudgmentGraph';
import { sortOptionsByMJ, findWinners } from '../utils/majorityJudgment';

const JudgmentViewPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);

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

  const sortedOptions = sortOptionsByMJ(vote.options || []);
  const winners = findWinners(sortedOptions);

  return (
    <div className="panel">
      <h2>{vote.title}</h2>
      <div style={{ marginTop: '16px' }}>
        {sortedOptions.map((option) => (
          <MajorityJudgmentGraph
            key={option.id}
            optionLabel={option.label}
            judgmentCounts={option.judgment_counts || {
              ToReject: 0,
              Insufficient: 0,
              OnlyAverage: 0,
              GoodEnough: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0,
            }}
            totalJudgments={option.total_judgments || 0}
            majorityTag={option.majority_tag}
            compact={false}
            isWinner={winners.has(option.id)}
            showSecond={winners.size > 1 && winners.has(option.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default JudgmentViewPage;
