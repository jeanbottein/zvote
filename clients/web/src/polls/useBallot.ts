import { useRef, useState } from 'react';

export type SubmissionMode = 'live' | 'envelope';

interface BallotOptions<B> {
  /** The ballot the server holds for this voter; an empty ballot if none. */
  saved: B;
  /** Casts a ballot. Resolves once the server's answer has been applied. */
  cast(ballot: B): Promise<void>;
  mode: SubmissionMode;
  equals(a: B, b: B): boolean;
  onError(error: unknown): void;
}

/**
 * A ballot being filled in.
 *
 * Live: each change is cast at once. Changes made while one is on its way are
 * neither lost nor all sent - the latest is cast next - so the server always
 * ends up with the voter's last choice, and the page shows that choice while
 * it travels. If casting fails, the page falls back to what the server holds.
 *
 * Envelope: changes stay on the page until submit(), and are kept if it fails.
 *
 * Withdrawing, in either mode, is cast like a live change: it drops unsent
 * changes and cannot overtake a ballot already on its way.
 */
export function useBallot<B>({ saved, cast, mode, equals, onError }: BallotOptions<B>) {
  const [draft, setDraft] = useState<B | null>(null);
  const [travelling, setTravelling] = useState<B | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useRef<{ next: B | null; sending: boolean }>({ next: null, sending: false });

  async function castLatest() {
    const pending = queue.current;
    if (pending.sending) {
      return; // the loop below picks up the newer ballot
    }
    pending.sending = true;
    while (pending.next !== null) {
      const ballot = pending.next;
      pending.next = null;
      try {
        await cast(ballot);
      } catch (error) {
        onError(error);
      }
    }
    pending.sending = false;
    setTravelling(null);
  }

  function send(ballot: B) {
    setDraft(null);
    setTravelling(ballot);
    queue.current.next = ballot;
    void castLatest();
  }

  async function submit() {
    if (draft === null) {
      return;
    }
    setBusy(true);
    try {
      await cast(draft);
      setDraft(null);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  return {
    /** What to show: the voter's latest choice, sent or not. */
    ballot: travelling ?? draft ?? saved,
    /** Envelope mode: whether there are changes to submit. */
    hasChanges: draft !== null && !equals(draft, saved),
    /** An envelope is being submitted. */
    busy,
    change: (ballot: B) => (mode === 'envelope' ? setDraft(ballot) : send(ballot)),
    submit,
    withdraw: send,
  };
}
