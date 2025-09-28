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
  }
  if (!vote) {
    return <div className="panel"><h2>Vote not found</h2></div>;
  }
  const winners = new Set(rankedOptions.filter(opt => opt.mjAnalysis.rank === 1).map(opt => opt.id));
  
  // Detect which options required settling mentions for ranking
  // Group options by majority mention AND strength to find exact ties
  const majorityGroups = new Map<string, any[]>();
  rankedOptions.forEach(option => {
    // Create key from both majority mention and strength percentage
    const majorityMention = option.mjAnalysis.majorityMention;
    const majorityStrength = option.mjAnalysis.majorityStrengthPercent;
    const groupKey = `${majorityMention}:${majorityStrength}`;
    
    if (!majorityGroups.has(groupKey)) {
      majorityGroups.set(groupKey, []);
    }
    majorityGroups.get(groupKey)!.push(option);
  });
  
  // Options that were in groups with multiple candidates needed settling mentions
  // Only when they have EXACT same majority mention AND same strength
  const optionsRequiringSettling = new Set<string>();
  majorityGroups.forEach(group => {
    if (group.length > 1) {
      // Multiple options had same majority mention AND same strength → settling needed
      group.forEach(option => optionsRequiringSettling.add(option.id));
    }
  });

  return (
    <div className="panel">
      <h2>{vote.title}</h2>
      {/* Tie-break strategy selector (view mode) */}
      <TieBreakSelector value={strategyKey} onChange={setStrategyKey} />
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
