import { useLayoutEffect, useRef, useState } from 'react';

export type SubmissionMode = 'live' | 'envelope';

interface BallotOptions<B> {
  /** The ballot the server holds for this voter; an empty ballot if none. */
  saved: B;
  /** Casts a ballot. Resolves once the server's answer has been applied. */
  cast(ballot: B): Promise<void>;
  /** What cast() adds to the ballot (the voter's name) differs from what the server holds. */
  castChanged: boolean;
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
 * What cast() adds is taken when the ballot leaves, never from an older
 * render, and recast() sends the ballot again once it changed.
 *
 * Envelope: changes, the voter's name included, stay on the page until
 * submit(), and are kept if it fails.
 *
 * Withdrawing, in either mode, is cast like a live change: it drops unsent
 * changes and cannot overtake a ballot already on its way.
 */
export function useBallot<B>({ saved, cast, castChanged, mode, equals, onError }: BallotOptions<B>) {
  const [draft, setDraft] = useState<B | null>(null);
  const [travelling, setTravelling] = useState<B | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useRef<{ next: B | null; sending: boolean }>({ next: null, sending: false });
  const latestCast = useRef(cast);
  useLayoutEffect(() => {
    latestCast.current = cast;
  });

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
        await latestCast.current(ballot);
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
    setBusy(true);
    try {
      await cast(draft ?? saved);
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
    /** Envelope mode: whether there is something to submit. */
    hasChanges: mode === 'envelope' && (castChanged || (draft !== null && !equals(draft, saved))),
    /** An envelope is being submitted. */
    busy,
    change: (ballot: B) => (mode === 'envelope' ? setDraft(ballot) : send(ballot)),
    submit,
    withdraw: send,
    /** Live mode: sends the ballot again, after any on its way, if what cast() adds may have changed. */
    recast() {
      if (mode === 'live' && (castChanged || travelling !== null)) {
        send(travelling ?? saved);
      }
    },
  };
}
