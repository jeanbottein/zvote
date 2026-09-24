import { useEffect, useState } from 'react';
import { ApiError, getPoll, watchPoll } from '../api/client';
import type { Poll } from '../api/types';

export type Connection = 'connecting' | 'live' | 'offline';

/**
 * One poll, kept up to date live.
 *
 * It is loaded first and watched second: the stream's first event is then at
 * least as recent as the loaded poll, so no update is missed or rolled back.
 * Updates carry nothing about the voter, so isMine and myBallot are kept.
 *
 * The state is not reset when the id changes; render one per poll, keyed by id.
 */
export function usePoll(id: string) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let active = true;
    let stopWatching = () => {};

    getPoll(id).then(
      (loaded) => {
        if (!active) {
          return;
        }
        setPoll(loaded);
        stopWatching = watchPoll(id, {
          onUpdate: (update) => setPoll((current) => current && { ...current, ...update }),
          onDeleted: () => setDeleted(true),
          onConnectionChange: (live) => setConnection(live ? 'live' : 'offline'),
        });
      },
      (failure: unknown) => {
        if (active) {
          setError(failure instanceof ApiError ? failure : new ApiError(0, String(failure)));
        }
      },
    );

    return () => {
      active = false;
      stopWatching();
    };
  }, [id]);

  return { poll, error, deleted, connection, setPoll };
}
