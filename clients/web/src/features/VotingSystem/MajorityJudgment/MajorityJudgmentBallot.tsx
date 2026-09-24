import { useId } from 'react';
import type { Mention } from '../../../api/types';
import { MENTION_NAMES, MENTIONS_BEST_FIRST } from './mentions';
import './mentions.css';
import './mj-ballot.css';

export interface MajorityJudgmentBallotProps {
  options: { id: string; label: string }[];
  /** The mention chosen for each option so far; options may be missing. */
  ballot: Record<string, Mention>;
  onChange(ballot: Record<string, Mention>): void;
  disabled?: boolean;
}

/**
 * One row per option, each a scale of the seven mentions from Excellent to Bad,
 * in the order and colours of the results graph. Each scale is a group of radio
 * buttons, so it works with a keyboard and a screen reader as well as a finger.
 */
export default function MajorityJudgmentBallot({ options, ballot, onChange, disabled }: MajorityJudgmentBallotProps) {
  const id = useId();

  return (
    <div className="mj-ballot">
      <div className="mj-scale-legend" aria-hidden="true">
        <span>Excellent</span>
        <span>Bad</span>
      </div>
      {options.map((option) => {
        const chosen = ballot[option.id];
        const group = `${id}-${option.id}`;
        return (
          <div key={option.id} className="mj-ballot-row" role="radiogroup" aria-labelledby={group}>
            <div className="mj-ballot-row-head">
              <span id={group} className="mj-ballot-option">{option.label}</span>
              <span className="mj-ballot-chosen" data-mention={chosen}>
                {chosen ? MENTION_NAMES[chosen] : 'Not rated yet'}
              </span>
            </div>
            <div className="mj-scale">
              {MENTIONS_BEST_FIRST.map((mention) => (
                <label key={mention} className="mj-scale-step" data-mention={mention}>
                  <input
                    type="radio"
                    name={group}
                    value={mention}
                    checked={chosen === mention}
                    disabled={disabled}
                    onChange={() => onChange({ ...ballot, [option.id]: mention })}
                  />
                  <span className="mj-scale-mark" aria-hidden="true" />
                  <span className="mj-scale-name">{MENTION_NAMES[mention]}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
