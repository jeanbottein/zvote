import React from 'react';
import { getAvailableStrategies, getActiveStrategyKey, setActiveStrategyKey } from '../utils/tiebreak';

type Props = {
  value?: string;
  onChange?: (key: string) => void;
};

const TieBreakSelector: React.FC<Props> = ({ value, onChange }) => {
  const strategies = getAvailableStrategies();
  const active = value || getActiveStrategyKey();

  const handleSelect = (key: string) => {
    setActiveStrategyKey(key);
    onChange?.(key);
  };

  return (
    <div className="panel" style={{ padding: '12px', marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, color: 'var(--muted)' }}>Tie-break strategy:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {strategies.map((s) => (
            <button
              key={s.key}
              onClick={() => handleSelect(s.key)}
              aria-pressed={active === s.key}
              className={active === s.key ? 'btn btn-primary' : 'btn'}
              title={s.description}
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TieBreakSelector;
