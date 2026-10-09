import { useEffect, useState } from 'react';
import { getServerInfo } from '../api/client';
import type { ServerInfo } from '../api/types';

/** The server's usual offer: what to assume until it answers, or if it cannot. */
const USUAL: ServerInfo = {
  features: { publicPolls: false, unlistedPolls: true, approvalVoting: true, majorityJudgment: true },
  limits: {
    maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100, maxVoterNameLength: 40, maxInvitations: 1000,
    pollLifetimeDays: 30,
  },
  publicUrl: null,
};

let request: Promise<ServerInfo> | null = null;

/**
 * What this server offers, asked once per page load. The server still checks
 * every poll it is sent, so a guess here can at worst produce a clear error.
 */
export function useServerInfo(): ServerInfo {
  const [info, setInfo] = useState(USUAL);

  useEffect(() => {
    let active = true;
    request ??= getServerInfo();
    request.then(
      (answer) => {
        if (active) {
          setInfo(answer);
        }
      },
      () => {
        request = null; // ask again next time
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return info;
}
