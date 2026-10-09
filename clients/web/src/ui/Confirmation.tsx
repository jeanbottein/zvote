interface ConfirmationProps {
  id: string;
  question: string;
  busy: boolean;
  keep: string;
  confirm: string;
  tone: 'primary' | 'danger';
  onKeep(): void;
  onConfirm(): void;
}

/** Asks before a change that cannot be undone. Takes the focus, on the choice that changes nothing. */
export default function Confirmation({ id, question, busy, keep, confirm, tone, onKeep, onConfirm }: ConfirmationProps) {
  return (
    <div className="confirm" role="alertdialog" aria-labelledby={id}>
      <p id={id}>{question}</p>
      <div className="button-row">
        <button type="button" className="button secondary" disabled={busy} onClick={onKeep} autoFocus>
          {keep}
        </button>
        <button type="button" className={`button ${tone}`} disabled={busy} onClick={onConfirm}>
          {confirm}
        </button>
      </div>
    </div>
  );
}
