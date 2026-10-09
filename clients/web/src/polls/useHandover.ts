import { useEffect, useState } from 'react';
import { takePollOver } from '../api/client';

type Handover = 'taking' | 'done';

/**
 * Takes a poll over with the token from a handover link, once, before the poll
 * is loaded: the page then shows it as this voter's from the first render.
 *
 * The token is dropped from the address afterwards, whether it worked or not.
 * It works once, so leaving it there would only make a reload fail - and a
 * link that opens the poll should keep opening it.
 */
export function useHandover(id: string, token: string | null): Handover {
  const [state, setState] = useState<Handover>(token === null ? 'done' : 'taking');

  useEffect(() => {
    if (token === null) return;
    let active = true;
    // Whether it is taken or spent, the poll is read the same way next.
    takePollOver(id, token).catch(() => {}).finally(() => {
      if (!active) return;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setState('done');
    });
    return () => { active = false; };
  }, [id, token]);

  return state;
}
