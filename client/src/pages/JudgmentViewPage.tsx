import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import MajorityJudgmentGraph from '../components/MajorityJudgmentGraph';
import { rankOptions } from '../utils/majorityJudgment';
import DeleteVoteButton from '../components/DeleteVoteButton';

const JudgmentViewPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);
  
  const rankedOptions: (any & { mjAnalysis: any })[] = useMemo(() => rankOptions((vote?.options || []) as any[]), [vote?.options]);

  useEffect(() => {
    if (token) {
      spacetimeDB.setFocusedVoteByToken(token).catch(console.warn);
    }
  }, [token]);

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
      <h2>{vote?.title || 'Vote not found'}</h2>
      <div style={{ marginTop: '16px' }}>
        {rankedOptions.map((option) => (
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
            totalBallots={option.total_judgments || 0}
            compact={false}
            rank={option.mjAnalysis.rank}
            isExAequo={rankedOptions.filter(opt => opt.mjAnalysis.rank === option.mjAnalysis.rank).length > 1}
          />
        ))}
      </div>

      <DeleteVoteButton
        voteId={vote.id}
        voteCreator={vote.creator}
        voteTitle={vote.title}
      />
    </div>
  );
};

export default JudgmentViewPage;
