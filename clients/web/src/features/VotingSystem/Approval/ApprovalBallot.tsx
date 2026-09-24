import './approval.css';

interface ApprovalBallotProps {
  options: { id: string; label: string }[];
  /** Ids of the approved options, in the poll's order. */
  approved: string[];
  onChange(approved: string[]): void;
  disabled?: boolean;
}

/** A checkbox per option: approve every option you would be happy with. */
export default function ApprovalBallot({ options, approved, onChange, disabled }: ApprovalBallotProps) {
  const chosen = new Set(approved);

  return (
    <fieldset className="approval-ballot" disabled={disabled}>
      <legend className="visually-hidden">Options you approve</legend>
      {options.map((option) => (
        <label key={option.id} className="approval-choice">
          <input
            type="checkbox"
            checked={chosen.has(option.id)}
            onChange={(event) => onChange(options
              .filter((other) => (other.id === option.id ? event.target.checked : chosen.has(other.id)))
              .map((other) => other.id))}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
