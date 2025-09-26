import React from 'react';
import MajorityJudgmentResultsGraph from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph';

interface JudgmentCounts {
  ToReject: number;
  Insufficient: number;
  OnlyAverage: number;
  GoodEnough: number;
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
}) => {
  return (
    <MajorityJudgmentResultsGraph
      optionLabel={optionLabel}
      judgmentCounts={judgmentCounts}
      totalBallots={totalJudgments}
      compact={compact}
      majorityTag={majorityTag}
      secondTag={secondTag}
      isWinner={isWinner}
      showSecond={showSecond}
    />
  );
};

export default MajorityJudgmentGraph;
