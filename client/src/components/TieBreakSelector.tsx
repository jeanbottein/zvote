import React from 'react';
import { getAvailableStrategies, getActiveStrategyKey, setActiveStrategyKey } from '../utils/tiebreak';

type Props = {
  value?: string;
  onChange?: (key: string) => void;
};

const TieBreakSelector: React.FC<Props> = ({ value, onChange }) => {
  const strategies = getAvailableStrategies();
  const active = value || getActiveStrategyKey();
  const activeStrategy = strategies.find(s => s.key === active) || strategies[0];

  const handleSelect = (key: string) => {
    setActiveStrategyKey(key);
    onChange?.(key);
  };

  return (
    <div className="panel" style={{ padding: '12px', marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Tie-break strategy:</span>
          <span className="badge" title={activeStrategy.description}>Active: {activeStrategy.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {strategies.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => handleSelect(s.key)}
                aria-pressed={isActive}
                className={`inline-choice-button${isActive ? ' active' : ''}`}
                title={s.description}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TieBreakSelector;
