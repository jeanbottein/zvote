import type { ReactNode } from 'react';

interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
  hint?: ReactNode;
}

/** One choice among a few, as radio buttons drawn side by side: keyboard arrows work. */
export default function SegmentedControl<T extends string>(
  { legend, name, value, options, onChange, hint }: SegmentedControlProps<T>,
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
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}
