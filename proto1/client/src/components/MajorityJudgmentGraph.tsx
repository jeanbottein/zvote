import React, { useEffect, useState } from 'react';
import { getColorMode, onColorModeChange } from '../lib/colorMode';

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
  // React to color mode (color vs colorblind)
  const [mode, setMode] = useState(getColorMode());
  useEffect(() => {
    const off = onColorModeChange(setMode);
    return () => off?.();
  }, []);

  // Palettes
  // Color: red -> blue -> green across the five mentions
  const judgmentColorsColor = {
    ToReject: '#dc2626',   // red-600
    Passable: '#3b82f6',   // blue-500
    Good: '#60a5fa',       // blue-400
    VeryGood: '#22c55e',   // green-500
    Excellent: '#16a34a'   // green-600
  } as const;

  // Colorblind: dark gray -> white
  const judgmentColorsGray = {
    ToReject: '#1f2937',   // gray-800
    Passable: '#4b5563',   // gray-600
    Good: '#9ca3af',       // gray-400
    VeryGood: '#d1d5db',   // gray-300
    Excellent: '#ffffff'   // white
  } as const;

  const judgmentColors = mode === 'colorblind' ? judgmentColorsGray : judgmentColorsColor;

  const judgmentLabels = {
    ToReject: 'To Reject',
    Passable: 'Passable',
    Good: 'Good',
    VeryGood: 'Very Good',
    Excellent: 'Excellent'
  };

  // Calculate majority judgment (median) — if no judgments, show placeholder
  const sortedJudgments = Object.entries(judgmentCounts)
    .flatMap(([judgment, count]) => Array(count).fill(judgment))
    .sort();
  const medianIndex = Math.floor(sortedJudgments.length / 2);
  const majorityJudgment = totalJudgments > 0 ? (sortedJudgments[medianIndex] || 'Passable') : null;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Majority mention</span>
          <div style={{ 
            fontSize: '12px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: majorityJudgment ? judgmentColors[majorityJudgment as keyof typeof judgmentColors] : 'var(--border)',
            color: (() => {
              if (!majorityJudgment) return 'var(--muted)';
              if (mode === 'colorblind') {
                const light = ['Good','VeryGood','Excellent'];
                return light.includes(majorityJudgment as string) ? '#0b0b0b' : '#ffffff';
              }
              return '#ffffff';
            })()
          }}>
            {majorityJudgment ? judgmentLabels[majorityJudgment as keyof typeof judgmentLabels] : '—'}
          </div>
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
          const percentage = totalJudgments > 0 ? (count / totalJudgments) * 100 : 20;
          return (
            <div
              key={judgment}
              style={{
                width: `${percentage}%`,
                backgroundColor: judgmentColors[judgment as keyof typeof judgmentColors],
                opacity: totalJudgments > 0 ? (count > 0 ? 1 : 0.1) : 0.08,
                transition: 'all 0.3s ease'
              }}
              title={`${judgmentLabels[judgment as keyof typeof judgmentLabels]}: ${count} votes`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MajorityJudgmentGraph;
