import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import MajorityJudgmentGraph from '../components/MajorityJudgmentGraph';
import { rankOptions } from '../utils/majorityJudgment';
import TieBreakSelector from '../components/TieBreakSelector';
import { getActiveStrategyKey } from '../utils/tiebreak';

const JudgmentViewPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);
  // Active tie-break strategy selection (must be before any early return)
  const [strategyKey, setStrategyKey] = useState<string>(getActiveStrategyKey());
  const rankedOptions = useMemo(() => rankOptions((vote?.options || []) as any[], strategyKey), [vote?.options, strategyKey]);

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
  if (!vote) {
    return <div className="panel"><h2>Vote not found</h2></div>;
  }
  const winners = new Set(rankedOptions.filter(opt => opt.mjAnalysis.rank === 1).map(opt => opt.id));
  

  return (
    <div className="panel">
      <h2>{vote?.title || 'Vote not found'}</h2>
      {/* Tie-break strategy selector (view mode) */}
      <div style={{ marginTop: '16px' }}>
        {rankedOptions.map((option: any) => (
          <MajorityJudgmentGraph
            key={option.id}
            optionLabel={option.label}
            judgmentCounts={option.judgment_counts || {
              Bad: 0,
              Inadequate: 0,
              Passable: 0,
              Fair: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0,
            }}
            totalJudgments={option.total_judgments || 0}
            majorityTag={option.majority_tag}
            compact={false}
            isWinner={winners.has(option.id)}
            showSecond={winners.size > 1 && winners.has(option.id)}
            rank={option.mjAnalysis.rank}
            isExAequo={rankedOptions.filter(opt => opt.mjAnalysis.rank === option.mjAnalysis.rank).length > 1}
            settlingMentionUsed={optionsRequiringSettling.has(option.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default JudgmentViewPage;
