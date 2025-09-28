import React from 'react';
import { computeMJAnalysis, type JudgmentCounts } from '../../../utils/majorityJudgment';

interface MajorityJudgmentResultsGraphProps {
  optionLabel: string;
  judgmentCounts: JudgmentCounts;
  totalBallots: number;
  compact?: boolean;
  rank?: number;
  isExAequo?: boolean;
  showSecond?: boolean;
  settlingMentionUsed?: boolean; // Indicates if settling mention was required for ranking
}

const MajorityJudgmentResultsGraph: React.FC<MajorityJudgmentResultsGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalBallots,
  compact = false,
  rank,
  isExAequo = false,
  settlingMentionUsed = false,
}) => {
  const judgmentLabels = {
    'Bad': 'Bad',
    'Inadequate': 'Inadequate', 
    'Passable': 'Passable',
    'Fair': 'Fair',
    'Good': 'Good',
    'VeryGood': 'Very Good',
    'Excellent': 'Excellent'
  };

  // Use the MJ library for complete analysis
  const mjAnalysis = computeMJAnalysis(judgmentCounts);
  const majorityJudgment = mjAnalysis.majorityMention;
  const hasSecondIteration = mjAnalysis.iterations.length > 1;
  const settlingJudgment = hasSecondIteration ? mjAnalysis.iterations[1].mention : null;
  const isWinner = rank === 1;
  
  // Show settling section when settling mention was required for ranking
  // This happens when this option was involved in a tie that needed to be broken
  const wasInvolvedInTieBreaking = settlingMentionUsed || (hasSecondIteration && settlingJudgment);
  const showSettlingSection = wasInvolvedInTieBreaking;

  // List mentions best-to-worst for visual left-to-right ordering
  const mentionsDesc: Array<keyof JudgmentCounts> = ['Excellent','VeryGood','Good','Fair','Passable','Inadequate','Bad'];

  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return { badge: '1', isMedal: true, medalType: 'gold' };
    if (rank === 2) return { badge: '2', isMedal: true, medalType: 'silver' };
    if (rank === 3) return { badge: '3', isMedal: true, medalType: 'bronze' };
    return { badge: rank.toString(), isMedal: false, medalType: null };
  };

  // Check if empty (no ballots)
  const isEmpty = totalBallots === 0;

  return (
    <div id={`mj-results-${optionLabel}`} className="mj-results-card" data-compact={compact ? 'true' : 'false'} data-winner={!isEmpty && isWinner ? 'true' : 'false'}>
      <div className="mj-results-header">
        <div className="mj-results-title-section">
          {!isEmpty && rank && (() => {
            const rankInfo = getRankBadge(rank);
            return rankInfo ? (
              <div className="mj-rank-container">
                <div 
                  className="mj-rank-badge" 
                  data-medal={rankInfo.isMedal ? rankInfo.medalType || 'true' : 'false'}
                >
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

        {mentionsDesc.map((judgment, index) => {
          const count = judgmentCounts[judgment] || 0;
          const percentage = totalBallots > 0 ? (count / totalBallots) * 100 : 0;
          
          // Don't render bars with 0 votes at all
          if (count === 0) {
            return null;
          }
          
          // Calculate "at least X" percentage (cumulative from this judgment and better)
          const atLeastCount = mentionsDesc.slice(0, index + 1).reduce((sum, j) => sum + (judgmentCounts[j] || 0), 0);
          const atLeastPercentage = totalBallots > 0 ? (atLeastCount / totalBallots) * 100 : 0;
          
          const tooltipText = `${atLeastPercentage.toFixed(1)}% of at least ${judgmentLabels[judgment]}`;
          
          return (
            <div
              key={judgment}
              className="mj-results-bar"
              data-judgment={judgment}
              data-has="true"
              data-index={index}
              style={{ width: `${percentage}%` }}
              title={tooltipText}
              onMouseEnter={(e) => {
                const chart = e.currentTarget.parentElement;
                if (chart) {
                  // Add hover class to chart container
                  chart.classList.add('mj-chart-hovering');
                  chart.setAttribute('data-hover-index', index.toString());
                }
              }}
              onMouseLeave={(e) => {
                const chart = e.currentTarget.parentElement;
                if (chart) {
                  // Remove hover class from chart container
                  chart.classList.remove('mj-chart-hovering');
                  chart.removeAttribute('data-hover-index');
                }
              }}
            />
          );
        }).filter(Boolean)}
      </div>

      {/* Majority and Settling mentions below the chart */}
      {!isEmpty && (
        <div className="mj-results-badges-below">
          <div className="mj-results-badges">
            <span className="mj-results-hint">Majority Mention:</span>
            <div className="mj-results-badge" data-judgment={majorityJudgment || undefined}>
              {majorityJudgment ? judgmentLabels[majorityJudgment as keyof typeof judgmentLabels] : '-'}
            </div>
            {mjAnalysis.majorityStrengthPercent >= 0 && (
              <div className="mj-majority-strength-badge" data-judgment={majorityJudgment} title={`${mjAnalysis.majorityPercentage.toFixed(1)}% rated at least ${judgmentLabels[majorityJudgment as keyof typeof judgmentLabels]}`}>
                +{mjAnalysis.majorityStrengthPercent.toFixed(2)}%
              </div>
            )}
            {showSettlingSection && (
              <>
                <span className="mj-results-hint" style={{ marginLeft: '8px' }}>Settling Mention:</span>
                <div className="mj-results-badge" data-variant="second" data-judgment={settlingJudgment || undefined} title="Settling mention used for tie-breaking when majority mentions are equal">
                  {hasSecondIteration && settlingJudgment ? judgmentLabels[settlingJudgment as keyof typeof judgmentLabels] : '-'}
                </div>
                {hasSecondIteration && mjAnalysis.iterations[1].strengthPercent >= 0 && (
                  <div className="mj-majority-strength-badge" data-judgment={settlingJudgment} title={`${mjAnalysis.iterations[1].percentage.toFixed(1)}% rated at least ${judgmentLabels[settlingJudgment as keyof typeof judgmentLabels]} (after removing majority votes) - higher percentage wins ties`}>
                    +{mjAnalysis.iterations[1].strengthPercent.toFixed(2)}%
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MajorityJudgmentResultsGraph;
