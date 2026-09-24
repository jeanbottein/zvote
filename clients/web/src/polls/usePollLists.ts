import { useEffect, useState } from 'react';
import { errorMessage, listMyPolls, listPublicPolls } from '../api/client';
import type { PollSummary } from '../api/types';

interface PollLists {
  /** The polls this voter created. */
  mine: PollSummary[];
  /** Other people's public polls. */
  others: PollSummary[];
}

export function usePollLists() {
  const [lists, setLists] = useState<PollLists | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listMyPolls(), listPublicPolls()]).then(
      ([mine, listed]) => {
        if (active) {
          setLists({ mine, others: listed.filter((poll) => !poll.isMine) });
        }
      },
      (failure: unknown) => {
        if (active) {
          setError(errorMessage(failure));
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { lists, error };
}
