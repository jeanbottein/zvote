import React from 'react';

interface JudgmentCounts {
  ToReject: number;
  Passable: number;
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
}

const MajorityJudgmentGraph: React.FC<MajorityJudgmentGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalJudgments,
  compact = false,
  majorityTag,
  secondTag,
}) => {
  // Colors handled by CSS via body[data-colorblind]

  const judgmentLabels = {
    ToReject: 'To Reject',
    Passable: 'Passable',
    Good: 'Good',
    VeryGood: 'Very Good',
    Excellent: 'Excellent'
  };

  // Correct order for mentions (for computing median)
  const mentionOrder: Record<keyof JudgmentCounts, number> = {
    ToReject: 1,
    Passable: 2,
    Good: 3,
    VeryGood: 4,
    Excellent: 5,
  };

  const computeMajority = (counts: JudgmentCounts, total: number): keyof JudgmentCounts | null => {
    if (total <= 0) return null;
    const expanded: Array<keyof JudgmentCounts> = (Object.entries(counts) as Array<[
      keyof JudgmentCounts,
      number
    ]>).flatMap(([m, n]) => Array(n).fill(m));
    expanded.sort((a, b) => mentionOrder[a] - mentionOrder[b]);
    const medianIdx = Math.floor(expanded.length / 2);
    return expanded[medianIdx] || null;
  };

  const computeSecond = (counts: JudgmentCounts, total: number, majority: keyof JudgmentCounts | null): keyof JudgmentCounts | null => {
    if (total <= 1 || !majority) return null;
    const copy: JudgmentCounts = { ...counts } as any;
    if (copy[majority] > 0) copy[majority] -= 1;
    return computeMajority(copy, total - 1);
  };

  const majorityJudgment = majorityTag as keyof JudgmentCounts | null ?? computeMajority(judgmentCounts, totalJudgments);
  const secondJudgment = secondTag as keyof JudgmentCounts | null ?? computeSecond(judgmentCounts, totalJudgments, majorityJudgment);

  return (
    <div id={`mj-card-${optionLabel}`} className="mj-card" data-compact={compact ? 'true' : 'false'}>
      <div className="mj-header">
        <div className="mj-title">{optionLabel}</div>
        <div className="mj-badges">
          <span className="mj-hint">Majority</span>
          <div className="mj-badge" data-judgment={majorityJudgment || undefined}>
            {majorityJudgment ? judgmentLabels[majorityJudgment as keyof typeof judgmentLabels] : '—'}
          </div>
          <span className="mj-hint" style={{ marginLeft: '8px' }}>Second</span>
          <div className="mj-badge" data-variant="second" data-judgment={secondJudgment || undefined} title="Tie-break mention">
            {secondJudgment ? judgmentLabels[secondJudgment as keyof typeof judgmentLabels] : '—'}
          </div>
        </div>
      </div>

      <div className="mj-chart">
        {Object.entries(judgmentCounts).map(([judgment, count]) => {
          const percentage = totalJudgments > 0 ? (count / totalJudgments) * 100 : 20;
          return (
            <div
              key={judgment}
              className="mj-bar"
              data-judgment={judgment}
              data-has={count > 0 ? 'true' : 'false'}
              style={{ ['--w' as any]: `${percentage}%` }}
              title={`${judgmentLabels[judgment as keyof typeof judgmentLabels]}: ${count} votes`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MajorityJudgmentGraph;
