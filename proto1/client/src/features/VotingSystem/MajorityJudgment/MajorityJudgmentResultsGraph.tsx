import React from 'react';

interface JudgmentCounts {
  ToReject: number;
  Insufficient: number;
  OnlyAverage: number;
  GoodEnough: number;
  Good: number;
  VeryGood: number;
  Excellent: number;
}

interface MajorityJudgmentResultsGraphProps {
  optionLabel: string;
  judgmentCounts: JudgmentCounts;
  totalBallots: number;
  compact?: boolean;
  majorityTag?: string | null;
  secondTag?: string | null;
  isWinner?: boolean;
  showSecond?: boolean;
  rank?: number;
  isExAequo?: boolean;
}

const MajorityJudgmentResultsGraph: React.FC<MajorityJudgmentResultsGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalBallots,
  compact = false,
  majorityTag,
  secondTag,
  isWinner = false,
  showSecond = false,
  rank,
  isExAequo = false,
}) => {
  const judgmentLabels = {
    ToReject: 'To Reject',
    Insufficient: 'Insufficient',
    OnlyAverage: 'Only Average',
    GoodEnough: 'Good Enough',
    Good: 'Good',
    VeryGood: 'Very Good',
    Excellent: 'Excellent'
  } as const;

  // Correct order for mentions (for computing median)
  const mentionOrder: Record<keyof JudgmentCounts, number> = {
    ToReject: 1,
    Insufficient: 2,
    OnlyAverage: 3,
    GoodEnough: 4,
    Good: 5,
    VeryGood: 6,
    Excellent: 7,
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

  const majorityJudgment = majorityTag as keyof JudgmentCounts | null ?? computeMajority(judgmentCounts, totalBallots);
  const secondJudgment = showSecond
    ? (secondTag as keyof JudgmentCounts | null ?? computeSecond(judgmentCounts, totalBallots, majorityJudgment))
    : null;

  // List mentions best-to-worst for visual left-to-right ordering
  const mentionsDesc: Array<keyof JudgmentCounts> = ['Excellent','VeryGood','Good','GoodEnough','OnlyAverage','Insufficient','ToReject'];

  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return { badge: '🥇', isMedal: true };
    if (rank === 2) return { badge: '🥈', isMedal: true };
    if (rank === 3) return { badge: '🥉', isMedal: true };
    return { badge: rank.toString(), isMedal: false };
  };

  return (
    <div id={`mj-results-${optionLabel}`} className="mj-results-card" data-compact={compact ? 'true' : 'false'} data-winner={isWinner ? 'true' : 'false'}>
      <div className="mj-results-header">
        <div className="mj-results-title-section">
          {rank && (() => {
            const rankInfo = getRankBadge(rank);
            return rankInfo ? (
              <div className="mj-rank-container">
                <div className="mj-rank-badge" data-medal={rankInfo.isMedal ? 'true' : 'false'}>
                  {rankInfo.badge}
                </div>
                {isExAequo && (
                  <span className="mj-ex-aequo">ex aequo</span>
                )}
              </div>
            ) : null;
          })()}
          <div className="mj-results-title">{optionLabel}</div>
        </div>
        <div className="mj-results-badges">
          <span className="mj-results-hint">Majority</span>
          <div className="mj-results-badge" data-judgment={majorityJudgment || undefined}>
            {majorityJudgment ? judgmentLabels[majorityJudgment as keyof typeof judgmentLabels] : '—'}
          </div>
          {showSecond && (
            <>
              <span className="mj-results-hint" style={{ marginLeft: '8px' }}>Second</span>
              <div className="mj-results-badge" data-variant="second" data-judgment={secondJudgment || undefined} title="Tie-break mention">
                {secondJudgment ? judgmentLabels[secondJudgment as keyof typeof judgmentLabels] : '—'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mj-results-chart">
        {/* Ticks 0..100% with emphasized 50% above the graph */}
        <div className="mj-results-ticks">
          {[0,10,20,30,40,50,60,70,80,90,100].map((p) => (
            <div key={p} className="mj-tick" data-major={p === 50 ? 'true' : 'false'} style={{ ['--left' as any]: `${p}%` }}>
              <span className="mj-tick-label">{p}%</span>
            </div>
          ))}
        </div>

        {mentionsDesc.map((judgment) => {
          const count = judgmentCounts[judgment] || 0;
          const percentage = totalBallots > 0 ? (count / totalBallots) * 100 : 0;
          return (
            <div
              key={judgment}
              className="mj-results-bar"
              data-judgment={judgment}
              data-has={count > 0 ? 'true' : 'false'}
              style={{ width: `${percentage}%` }}
              title={`${judgmentLabels[judgment]}: ${count} ballots (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MajorityJudgmentResultsGraph;
