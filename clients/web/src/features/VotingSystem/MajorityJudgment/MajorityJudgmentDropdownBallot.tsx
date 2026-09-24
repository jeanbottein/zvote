import { useId } from 'react';
import type { Mention } from '../../../api/types';
import type { MajorityJudgmentBallotProps } from './MajorityJudgmentBallot';
import { MENTION_NAMES, MENTIONS_BEST_FIRST } from './mentions';
import './mentions.css';
import './mj-ballot.css';

/** The same ballot as a dropdown per option: compact, and native on phones. */
export default function MajorityJudgmentDropdownBallot(
  { options, ballot, onChange, disabled }: MajorityJudgmentBallotProps,
) {
  const id = useId();

  return (
    <div className="mj-dropdowns">
      {options.map((option) => {
        const select = `${id}-${option.id}`;
        const chosen = ballot[option.id];
        return (
          <div key={option.id} className="mj-dropdown-row">
            <label htmlFor={select}>{option.label}</label>
            <select
              id={select}
              value={chosen ?? ''}
              data-mention={chosen}
              disabled={disabled}
              onChange={(event) => onChange({ ...ballot, [option.id]: event.target.value as Mention })}
            >
              <option value="" disabled>Choose a mention…</option>
              {MENTIONS_BEST_FIRST.map((mention) => (
                <option key={mention} value={mention}>{MENTION_NAMES[mention]}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
