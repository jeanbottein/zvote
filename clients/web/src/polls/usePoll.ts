import { useEffect, useState } from 'react';
import { ApiError, errorMessage, getPoll, watchPoll } from '../api/client';
import type { Poll } from '../api/types';

export type Connection = 'connecting' | 'live' | 'offline';

/** How long to wait before following a poll again once its stream is lost. */
export const RETRY_DELAY = 5000;

/**
 * One poll, kept up to date live, as seen with the invitation the voter came
 * with, if any.
 *
 * It is loaded first and watched second: the stream's first event is then at
 * least as recent as the loaded poll, so no update is missed or rolled back.
 * Updates carry nothing about the voter, so isMine and myBallot are kept.
 *
 * When the browser gives up on the stream (the server answered with an error,
 * as it does while it restarts), the poll is loaded and watched again a little
 * later, until that works or the poll turns out to be gone.
 *
 * The state is not reset when the id or the invitation changes; render one per
 * poll and invitation, keyed by both.
 */
export function usePoll(id: string, invitation: string | null) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let active = true;
    let loaded = false;
    let stopWatching = () => {};
    let retry: number | undefined;
    const followLater = () => {
      retry = window.setTimeout(follow, RETRY_DELAY);
    };

    function follow() {
      getPoll(id, invitation).then(
        (current) => {
          if (!active) {
            return;
          }
          loaded = true;
          setPoll(current);
          stopWatching = watchPoll(id, {
            onUpdate: (update) => setPoll((shown) => shown && { ...shown, ...update }),
            onDeleted: () => setDeleted(true),
            onConnectionChange: (live) => setConnection(live ? 'live' : 'offline'),
            onLost: followLater,
          });
        },
        (failure: unknown) => {
          if (!active) {
            return;
          }
          if (!loaded) {
            setError(failure instanceof ApiError ? failure : new ApiError(0, errorMessage(failure)));
          } else if (failure instanceof ApiError && failure.status === 404) {
            setDeleted(true);
          } else {
            followLater();
          }
        },
      );
    }

    follow();
    return () => {
      active = false;
      stopWatching();
      window.clearTimeout(retry);
    };
  }, [id, invitation]);

  return { poll, error, deleted, connection, setPoll };
}
