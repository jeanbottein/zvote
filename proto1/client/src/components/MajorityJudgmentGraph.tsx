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
  // React to color mode (color vs colorblind)
  const [mode, setMode] = useState(getColorMode());
  useEffect(() => {
    const off = onColorModeChange(setMode);
    return () => off?.();
  }, []);

  // Palettes
  // Color: red -> orange -> yellow -> light green -> dark green
  const judgmentColorsColor = {
    ToReject: '#dc2626',   // red-600
    Passable: '#f97316',   // orange-500
    Good: '#facc15',       // yellow-400
    VeryGood: '#4ade80',   // green-400 (light green)
    Excellent: '#16a34a'   // green-600 (dark green)
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
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Majority</span>
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
              // For bright backgrounds (yellow, light green), use dark text
              const bright = ['Good','VeryGood'];
              return bright.includes(majorityJudgment as string) ? '#0b0b0b' : '#ffffff';
            })()
          }}>
            {majorityJudgment ? judgmentLabels[majorityJudgment as keyof typeof judgmentLabels] : '—'}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>Second</span>
          <div style={{ 
            fontSize: '12px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: secondJudgment ? judgmentColors[secondJudgment as keyof typeof judgmentColors] : 'var(--border)',
            border: '1px dashed var(--border)',
            color: (() => {
              if (!secondJudgment) return 'var(--muted)';
              if (mode === 'colorblind') {
                const light = ['Good','VeryGood','Excellent'];
                return light.includes(secondJudgment as string) ? '#0b0b0b' : '#ffffff';
              }
              const bright = ['Good','VeryGood'];
              return bright.includes(secondJudgment as string) ? '#0b0b0b' : '#ffffff';
            })()
          }} title="Tie-break mention">
            {secondJudgment ? judgmentLabels[secondJudgment as keyof typeof judgmentLabels] : '—'}
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
