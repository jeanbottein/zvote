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
}

const MajorityJudgmentGraph: React.FC<MajorityJudgmentGraphProps> = ({ 
  optionLabel, 
  judgmentCounts, 
  totalJudgments,
  compact = false 
}) => {
  const judgmentColors = {
    ToReject: '#dc2626',     // Red
    Passable: '#ea580c',     // Orange
    Good: '#ca8a04',         // Yellow/Gold
    VeryGood: '#16a34a',     // Green
    Excellent: '#2563eb'     // Blue
  };

  const judgmentLabels = {
    ToReject: 'To Reject',
    Passable: 'Passable',
    Good: 'Good',
    VeryGood: 'Very Good',
    Excellent: 'Excellent'
  };

  if (totalJudgments === 0) {
    return (
      <div style={{ 
        padding: compact ? '8px' : '12px', 
        border: '1px solid var(--border)', 
        borderRadius: '8px',
        marginBottom: compact ? '4px' : '8px'
      }}>
        <div style={{ fontWeight: '500', marginBottom: '4px' }}>{optionLabel}</div>
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No judgments yet</div>
      </div>
    );
  }

  // Calculate majority judgment (median)
  const sortedJudgments = Object.entries(judgmentCounts)
    .flatMap(([judgment, count]) => Array(count).fill(judgment))
    .sort();
  
  const medianIndex = Math.floor(sortedJudgments.length / 2);
  const majorityJudgment = sortedJudgments[medianIndex] || 'Passable';

  return (
    <div style={{ 
      padding: compact ? '8px' : '12px', 
      border: '1px solid var(--border)', 
      borderRadius: '8px',
      marginBottom: compact ? '4px' : '8px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px' 
      }}>
        <div style={{ fontWeight: '500' }}>{optionLabel}</div>
        <div style={{ 
          fontSize: '12px',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: judgmentColors[majorityJudgment as keyof typeof judgmentColors],
          color: 'white'
        }}>
          {judgmentLabels[majorityJudgment as keyof typeof judgmentLabels]}
        </div>
      </div>

      {/* Visual bar chart */}
      <div style={{ 
        display: 'flex', 
        height: compact ? '16px' : '24px', 
        borderRadius: '4px', 
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        {Object.entries(judgmentCounts).map(([judgment, count]) => {
          const percentage = totalJudgments > 0 ? (count / totalJudgments) * 100 : 0;
          return (
            <div
              key={judgment}
              style={{
                width: `${percentage}%`,
                backgroundColor: judgmentColors[judgment as keyof typeof judgmentColors],
                opacity: count > 0 ? 1 : 0.1,
                transition: 'all 0.3s ease'
              }}
              title={`${judgmentLabels[judgment as keyof typeof judgmentLabels]}: ${count} votes (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Detailed breakdown */}
      {!compact && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '11px', 
          color: 'var(--muted)',
          marginTop: '4px'
        }}>
          {Object.entries(judgmentCounts).map(([judgment, count]) => (
            <span key={judgment} style={{ textAlign: 'center' }}>
              {count}
            </span>
          ))}
        </div>
      )}

      <div style={{ 
        fontSize: '12px', 
        color: 'var(--muted)', 
        marginTop: compact ? '4px' : '8px',
        textAlign: 'center'
      }}>
        {totalJudgments} judgment{totalJudgments !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default MajorityJudgmentGraph;
