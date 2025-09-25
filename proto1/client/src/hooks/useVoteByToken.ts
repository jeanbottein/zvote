import { useCallback, useEffect, useMemo, useState } from 'react';
import { spacetimeDB } from '../lib/spacetimeClient';
import { VoteWithOptions } from './useVotes';

// Build a single vote with options and summaries from the local SpacetimeDB cache
function buildVoteByTokenFromCache(token: string): VoteWithOptions | null {
  if (!spacetimeDB.connection) return null;
  const db: any = spacetimeDB.connection.db;

  // Find vote by token
  let voteRow: any | null = null;
  for (const v of db.vote.iter() as Iterable<any>) {
    if ((v.token || '') === token) {
      voteRow = v;
      break;
    }
  }
  if (!voteRow) return null;

  const voteIdStr = voteRow.id.toString();

  // Prepare MJ summaries lookup
  const summaryByOptionId = new Map<string, any>();
  try {
    for (const s of (db.mjSummary?.iter?.() || []) as Iterable<any>) {
      if (String(s.voteId || '') === voteIdStr) {
        summaryByOptionId.set(String(s.optionId), s);
      }
    }
  } catch {}

  // Build options
  const options: any[] = [];
  for (const option of db.voteOption.iter() as Iterable<any>) {
    if (option.voteId?.toString() === voteIdStr) {
      // Count approvals
      let approvalsCount = 0;
      for (const approval of db.approval.iter() as Iterable<any>) {
        if (approval.optionId?.toString() === option.id.toString()) {
          approvalsCount++;
        }
      }
      // MJ counts
      let judgmentCounts: Record<string, number> = { ToReject: 0, Passable: 0, Good: 0, VeryGood: 0, Excellent: 0 };
      let totalJudgments = 0;
      const sumRow = summaryByOptionId.get(String(option.id));
      if (sumRow) {
        judgmentCounts = {
          ToReject: Number(sumRow.toReject || 0),
          Passable: Number(sumRow.passable || 0),
          Good: Number(sumRow.good || 0),
          VeryGood: Number(sumRow.veryGood || 0),
          Excellent: Number(sumRow.excellent || 0)
        };
        totalJudgments = Number(sumRow.total || 0);
      } else {
        for (const judgment of db.judgment.iter() as Iterable<any>) {
          if (judgment.optionId?.toString() === option.id.toString()) {
            const m = judgment.mention?.tag;
            if (m && (judgmentCounts as any).hasOwnProperty(m)) judgmentCounts[m]++;
          }
        }
        totalJudgments = Object.values(judgmentCounts).reduce((a, b) => a + b, 0);
      }
      options.push({
        id: option.id.toString(),
        label: option.label,
        approvals_count: approvalsCount,
        judgment_counts: judgmentCounts,
        total_judgments: totalJudgments,
        majority_tag: sumRow?.majority?.tag ?? null,
        second_tag: sumRow?.second?.tag ?? null,
      });
    }
  }

  const voteData: VoteWithOptions = {
    id: voteRow.id.toString(),
    creator: voteRow.creator?.toString?.() || '',
    title: voteRow.title,
    public: voteRow.visibility?.tag === 'Public',
    visibility: voteRow.visibility,
    created_at: Number(voteRow.createdAt || 0),
    createdAt: Number(voteRow.createdAt || 0),
    token: voteRow.token || '',
    voting_system: voteRow.votingSystem,
    votingSystem: voteRow.votingSystem,
    options: options,
  };
  return voteData;
}

export function useVoteByToken(token: string | null) {
  const [vote, setVote] = useState<VoteWithOptions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(!!spacetimeDB.connection);
  const [subsApplied, setSubsApplied] = useState<boolean>(spacetimeDB.subscriptionsApplied);

  // Track connection changes to re-run effect and attach listeners when ready
  useEffect(() => {
    const onConn = (isConnected: boolean) => {
      console.debug('[useVoteByToken] connection change:', isConnected);
      setConnected(isConnected);
    };
    spacetimeDB.onConnectionChange(onConn);
    return () => spacetimeDB.offConnectionChange(onConn);
  }, []);

  // Track initial subscriptions application
  useEffect(() => {
    if (spacetimeDB.subscriptionsApplied) setSubsApplied(true);
    const onApplied = () => {
      console.debug('[useVoteByToken] subscriptions applied');
      setSubsApplied(true);
    };
    spacetimeDB.onSubscriptionsApplied(onApplied);
    return () => spacetimeDB.offSubscriptionsApplied(onApplied);
  }, []);

  const rebuild = useCallback(() => {
    if (!token) return;
    try {
      const v = buildVoteByTokenFromCache(token);
      if (v) {
        console.debug('[useVoteByToken] rebuild: vote found', v.id, v.title);
        setVote(v);
        setError(null);
        setLoading(false);
      } else {
        console.debug('[useVoteByToken] rebuild: vote not in cache yet for token', token);
        // do not set error immediately; data may not be applied yet
      }
    } catch (e) {
      setError('Failed to build vote');
      setLoading(false);
    }
  }, [token]);

  // Rebuild as soon as initial subscriptions apply (deep link readiness)
  useEffect(() => {
    if (!token) return;
    if (!subsApplied) return;
    let cancelled = false;
    const start = Date.now();
    const tryBuild = () => {
      if (cancelled) return;
      try {
        const v = buildVoteByTokenFromCache(token);
        if (v) {
          setVote(v);
          setError(null);
          setLoading(false);
          return; // stop polling
        }
      } catch (e) {
        // ignore; will retry
      }
      if (Date.now() - start < 10000) {
        setTimeout(tryBuild, 250);
      } else {
        // Timed out; allow UI to show not-found
        setLoading(false);
      }
    };
    tryBuild();
    return () => {
      cancelled = true;
    };
  }, [token, subsApplied, rebuild]);

  // Fallback: if for any reason subscriptionsApplied doesn't fire, poll after connection
  useEffect(() => {
    if (!token) return;
    if (!connected) return;
    if (vote) return;
    let cancelled = false;
    const start = Date.now();
    const tryBuild = () => {
      if (cancelled) return;
      try {
        const v = buildVoteByTokenFromCache(token);
        if (v) {
          console.debug('[useVoteByToken] connected-poll: vote found');
          setVote(v);
          setError(null);
          setLoading(false);
          return;
        }
      } catch {}
      if (Date.now() - start < 10000) {
        setTimeout(tryBuild, 250);
      } else {
        console.debug('[useVoteByToken] connected-poll: timed out');
        setLoading(false);
      }
    };
    tryBuild();
    return () => { cancelled = true; };
  }, [token, connected, vote]);

  // Final unconditional safety: after 12s from mount of this token, stop loading
  useEffect(() => {
    if (!token) return;
    if (vote) return;
    const t = setTimeout(() => {
      console.debug('[useVoteByToken] final safety timeout -> stop loading');
      setLoading(false);
    }, 12000);
    return () => clearTimeout(t);
  }, [token, vote]);

  useEffect(() => {
    setLoading(true);
    setVote(null);
    setError(null);

    if (!token) {
      setLoading(false);
      setError('Missing token');
      return;
    }

    const tryNow = () => {
      console.debug('[useVoteByToken] initial try rebuild (connected:', !!spacetimeDB.connection, ', subsApplied:', spacetimeDB.subscriptionsApplied, ')');
      rebuild();
    };

    // Initial attempt (may return null until data arrives)
    tryNow();

    // Subscribe to relevant table changes to keep the single vote fresh
    const conn = spacetimeDB.connection;
    if (!conn) {
      // Wait for connection; listeners will be attached when `connected` flips true
      return;
    }

    // Ensure focused subscriptions for this token
    if (token) {
      spacetimeDB.setFocusedVoteByToken(token).catch(() => {});
    }

    const listeners: Array<() => void> = [];
    try {
      const tables = [conn.db.vote, conn.db.voteOption, conn.db.approval, conn.db.judgment];
      // mjSummary may not exist on very old servers
      const mjs = (conn.db as any).mjSummary;
      const add = (tbl: any) => {
        const onI = (_c: any, _r: any) => rebuild();
        const onU = (_c: any, _o: any, _n: any) => rebuild();
        const onD = (_c: any, _r: any) => rebuild();
        tbl.onInsert(onI); tbl.onUpdate?.(onU); tbl.onDelete(onD);
        listeners.push(() => { try { tbl.removeOnInsert(onI); } catch {} try { tbl.removeOnUpdate?.(onU); } catch {} try { tbl.removeOnDelete(onD); } catch {} });
      };
      tables.forEach(add);
      if (mjs) add(mjs);
    } catch {}

    return () => {
      listeners.forEach(fn => fn());
    };
  }, [token, rebuild, connected, subsApplied]);

  // Note: do not end loading via a short fallback; the polling loop above will stop after 10s

  const totalVoters = useMemo(() => {
    if (!vote?.options || vote.options.length === 0) return 0;
    return vote.options.reduce((max, o) => Math.max(max, o.approvals_count || 0), 0);
  }, [vote]);

  return { vote, loading, error, totalVoters };
}
