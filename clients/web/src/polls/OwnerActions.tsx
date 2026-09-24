import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { deletePoll, errorMessage, setPollClosed } from '../api/client';
import type { Poll } from '../api/types';
import { useToast } from '../ui/Toasts';

interface OwnerActionsProps {
  poll: Poll;
  onChange(poll: Poll): void;
}

/** What only the poll's creator can do: close or reopen voting, and delete the poll. */
export default function OwnerActions({ poll, onChange }: OwnerActionsProps) {
  const navigate = useNavigate();
  const showToast = useToast();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  // No toast: the page itself shows the poll closing or reopening.
  const toggleClosed = () => run(async () => {
    onChange(await setPollClosed(poll.id, !closed));
  });

  const remove = () => run(async () => {
    await deletePoll(poll.id);
    showToast('The poll was deleted.');
    navigate('/');
  });

  return (
    <section className="panel owner-actions" aria-labelledby={titleId}>
      <h2 id={titleId}>Manage your poll</h2>
      <div className="button-row">
        <button type="button" className="button secondary" disabled={busy} onClick={toggleClosed}>
          {closed ? 'Reopen voting' : 'Close voting'}
        </button>
        {!confirmingDelete && (
          <button type="button" className="button danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
            Delete poll
          </button>
        )}
      </div>
      {confirmingDelete && (
        <div className="confirm" role="alertdialog" aria-labelledby={`${titleId}-confirm`}>
          <p id={`${titleId}-confirm`}>
            Delete this poll and all its ballots? Everyone watching it will see it disappear. This cannot be undone.
          </p>
          <div className="button-row">
            <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={remove}>
              Delete for good
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
