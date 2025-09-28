import React from 'react';
import MajorityJudgmentResultsGraph from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph';

interface JudgmentCounts {
  Bad: number;
  Inadequate: number;
  Passable: number;
  Fair: number;
  Good: number;
  VeryGood: number;
  Excellent: number;
}

interface MajorityJudgmentGraphProps {
  optionLabel: string;
  judgmentCounts: JudgmentCounts;
  totalBallots: number;
  compact?: boolean;
  rank?: number;
  isExAequo?: boolean;
}

const MajorityJudgmentGraph: React.FC<MajorityJudgmentGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalBallots,
  compact = false,
  rank,
  isExAequo = false,
}) => {
  return (
    <MajorityJudgmentResultsGraph
      optionLabel={optionLabel}
      judgmentCounts={judgmentCounts}
      totalBallots={totalBallots}
      compact={compact}
      rank={rank}
      isExAequo={isExAequo}
    />
  );
};

export default MajorityJudgmentGraph;
