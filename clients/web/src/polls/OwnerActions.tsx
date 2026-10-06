import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { deletePoll, errorMessage, setPollClosed } from '../api/client';
import type { Poll } from '../api/types';
import { useToast } from '../ui/Toasts';
import { showsResults } from './showsResults';

interface OwnerActionsProps {
  poll: Poll;
  onChange(poll: Poll): void;
}

/** What only the poll's creator can do: close voting, for good, and delete the poll. Both ask first. */
export default function OwnerActions({ poll, onChange }: OwnerActionsProps) {
  const navigate = useNavigate();
  const showToast = useToast();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<'close' | 'delete' | null>(null);
  const closed = poll.closedAt !== null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  // No toast: the page itself shows the poll closing.
  const close = () => run(async () => {
    onChange(await setPollClosed(poll.id, true));
    setConfirming(null);
  });

  const remove = () => run(async () => {
    await deletePoll(poll.id);
    showToast('The poll was deleted.');
    navigate('/');
  });

  return (
    <section className="panel owner-actions" aria-labelledby={titleId}>
      <h2 id={titleId}>Manage your poll</h2>
      {confirming === null && (
        <div className="button-row">
          {!closed && (
            <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirming('close')}>
              Close voting
            </button>
          )}
          <button type="button" className="button danger" disabled={busy} onClick={() => setConfirming('delete')}>
            Delete poll
          </button>
        </div>
      )}
      {confirming === 'close' && (
        <Confirmation
          id={`${titleId}-confirm`}
          question={showsResults(poll)
            ? 'Close voting for good? Nobody can vote or change their ballot any more, and the results become final. A closed poll cannot be reopened.'
            : 'Close voting for good? Nobody can vote or change their ballot any more, and everyone sees the final results. A closed poll cannot be reopened.'}
          busy={busy}
          keep="Keep it open"
          confirm="Close for good"
          tone="primary"
          onKeep={() => setConfirming(null)}
          onConfirm={close}
        />
      )}
      {confirming === 'delete' && (
        <Confirmation
          id={`${titleId}-confirm`}
          question="Delete this poll and all its ballots? Everyone watching it will see it disappear. This cannot be undone."
          busy={busy}
          keep="Keep it"
          confirm="Delete for good"
          tone="danger"
          onKeep={() => setConfirming(null)}
          onConfirm={remove}
        />
      )}
    </section>
  );
}

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

function Confirmation({ id, question, busy, keep, confirm, tone, onKeep, onConfirm }: ConfirmationProps) {
  return (
    <div className="confirm" role="alertdialog" aria-labelledby={id}>
      <p id={id}>{question}</p>
      <div className="button-row">
        <button type="button" className="button secondary" disabled={busy} onClick={onKeep}>
          {keep}
        </button>
        <button type="button" className={`button ${tone}`} disabled={busy} onClick={onConfirm}>
          {confirm}
        </button>
      </div>
    </div>
  );
}
