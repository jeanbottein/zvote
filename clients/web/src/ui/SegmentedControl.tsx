import type { ReactNode } from 'react';

interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
  hint?: ReactNode;
  /** A hint that warns of a consequence, rather than explains. */
  hintTone?: 'warning';
  /** What the chosen option needs filled in, between the options and the hint. */
  children?: ReactNode;
}

/** One choice among a few, as radio buttons drawn side by side: keyboard arrows work. */
export default function SegmentedControl<T extends string>(
  { legend, name, value, options, onChange, hint, hintTone, children }: SegmentedControlProps<T>,
) {
  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="segmented-options">
        {options.map((option) => (
          <label key={option.value} className="segmented-option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {children}
      {hint && <p className="hint" data-tone={hintTone}>{hint}</p>}
    </fieldset>
  );
}
