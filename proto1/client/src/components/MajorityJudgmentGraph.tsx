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
  totalJudgments: number;
  compact?: boolean;
  majorityTag?: string | null;
  secondTag?: string | null;
  isWinner?: boolean;
  showSecond?: boolean;
  rank?: number;
  isExAequo?: boolean;
  settlingMentionUsed?: boolean;
}

const MajorityJudgmentGraph: React.FC<MajorityJudgmentGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalJudgments,
  compact = false,
  majorityTag,
  secondTag,
  isWinner = false,
  showSecond = false,
  rank,
  isExAequo = false,
  settlingMentionUsed = false,
}) => {
  return (
    <MajorityJudgmentResultsGraph
      optionLabel={optionLabel}
      judgmentCounts={judgmentCounts}
      totalBallots={totalJudgments}
      compact={compact}
      rank={rank}
      isExAequo={isExAequo}
      settlingMentionUsed={settlingMentionUsed}
    />
  );
};

export default MajorityJudgmentGraph;
