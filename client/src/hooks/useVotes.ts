import { useState, useEffect, useCallback } from 'react';
import { deepEqual } from 'spacetimedb';
import { spacetimeDB } from '../lib/spacetimeClient';
import { VotingSystem } from '../generated/voting_system_type';

// Visibility constants matching server
export const VISIBILITY_PUBLIC = 0;
export const VISIBILITY_UNLISTED = 1;
export const VISIBILITY_PRIVATE = 2;

// Helper function to convert visibility number to display name
export function getVisibilityDisplayName(visibility: number): string {
  switch (visibility) {
    case VISIBILITY_PUBLIC: return 'Public';
    case VISIBILITY_UNLISTED: return 'Unlisted';
    case VISIBILITY_PRIVATE: return 'Private';
    default: return 'Unknown';
  }
}

// Extended vote type with options and backward compatibility
export interface VoteWithOptions {
  id: string;
  creator: string; // Convert Identity to string for compatibility
  title: string;
  public: boolean; // Computed from visibility for backward compatibility
  visibility: number; // 0=Public, 1=Unlisted, 2=Private
  created_at: number; // Convert Timestamp to number for compatibility
  createdAt: number;
  token: string;
  voting_system: VotingSystem; // Keep old name for compatibility
  votingSystem: VotingSystem;
  options?: Array<{
    id: string;
    label: string;
    approvals_count: number;
    judgment_counts?: {
      Bad: number;
      Inadequate: number;
      Passable: number;
      Fair: number;
      Good: number;
      VeryGood: number;
      Excellent: number;
    };
    total_judgments?: number;
    majority_tag?: string | null;
  }>;
}

export const useVotes = () => {
  const [myVotes, setMyVotes] = useState<VoteWithOptions[]>([]);
  const [publicVotes, setPublicVotes] = useState<VoteWithOptions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateVotes = useCallback(() => {
    if (!spacetimeDB.connection || !spacetimeDB.currentUser) {
      setMyVotes([]);
      setPublicVotes([]);
      setIsLoading(false);
      return;
    }

    try {
      // Debug: table counts
      try {
        const db: any = spacetimeDB.connection.db;
        console.debug('[useVotes] counts', {
          vote: db.vote?.count?.(),
          voteOption: db.voteOption?.count?.(),
          mjSummary: (db as any).mjSummary?.count?.(),
        });
      } catch {}

      const allVotes: VoteWithOptions[] = [];
      const creatorById = new Map<string, any>();

      // Build a lookup for MJ summaries by optionId for fast access
      const summaryByOptionId = new Map<string, any>();
      try {
        for (const s of (spacetimeDB.connection.db as any).mjSummary.iter() as Iterable<any>) {
          summaryByOptionId.set(String(s.optionId), s);
        }
      } catch (_) {
        // If mj_summary is not available yet, we'll fall back to judgment scan
      }
      
      // Get all votes from the database
      for (const vote of (spacetimeDB.connection.db as any).vote.iter() as Iterable<any>) {
        const voteData: VoteWithOptions = {
          id: vote.id.toString(),
          creator: vote.creator.toString(), // Keep string for display, but store raw in map below
          title: vote.title,
          public: vote.visibility === VISIBILITY_PUBLIC, // Convert visibility to boolean
          visibility: Number(vote.visibility || VISIBILITY_PUBLIC),
          created_at: Number(vote.createdAt || 0),
          createdAt: Number(vote.createdAt || 0),
          token: vote.token || '',
          voting_system: vote.votingSystem,
          votingSystem: vote.votingSystem,
          options: []
        };

        // Save raw creator object for robust comparisons later
        try { creatorById.set(voteData.id, vote.creator); } catch {}

        // Get options for this vote
        const options: any[] = [];
        for (const option of (spacetimeDB.connection.db as any).voteOption.iter() as Iterable<any>) {
          if (option.voteId?.toString() === vote.id.toString()) {
            // Use server-maintained aggregates
            const approvalsCount = Number(option.approvalsCount || 0);
            // Majority Judgment counts: use mj_summary only (privacy-safe)
            let judgmentCounts = {
              Bad: 0,
              Inadequate: 0,
              Passable: 0,
              Fair: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0,
            } as Record<string, number>;
            let totalJudgments = 0;
            const sumRow = summaryByOptionId.get(String(option.id));
            if (sumRow) {
              judgmentCounts = {
                Bad: Number(sumRow.bad || 0),
                Inadequate: Number(sumRow.inadequate || 0),
                Passable: Number(sumRow.passable || 0),
                Fair: Number(sumRow.fair || 0),
                Good: Number(sumRow.good || 0),
                VeryGood: Number(sumRow.veryGood || 0),
                Excellent: Number(sumRow.excellent || 0),
              };
              totalJudgments = Number(sumRow.total || 0);
            }

            options.push({
              label: option.label,
              approvals_count: approvalsCount,
              judgment_counts: judgmentCounts,
              total_judgments: totalJudgments,
              majority_tag: sumRow?.majority?.tag ?? null,
            });
          }
        }
        
        // Sort options by order_index or approvals_count
        options.sort((a, b) => b.approvals_count - a.approvals_count);
        voteData.options = options;
        
        allVotes.push(voteData);
      }

      // Sort votes by creation date (newest first)
      allVotes.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      // With RLS, the server is the source of truth. The client receives only the votes it's allowed to see.
      // We just need to separate them into 'my' and 'other' votes. Compare identities robustly.
      const normalizeId = (s: string) => {
        const m = s?.toString?.().match(/0x([0-9a-f]+)/i);
        return m ? m[1].toLowerCase() : s?.toString?.().toLowerCase?.() || '';
      };
      const idObj = spacetimeDB.identityObject;
      const rawCurrent = idObj?.toString?.() || spacetimeDB.currentUser.identity;
      const currentNorm = normalizeId(rawCurrent);

      const myVotesList = allVotes.filter(vote => {
        const creatorObj = creatorById.get(vote.id);
        const isMine = creatorObj ? deepEqual(creatorObj, idObj) : normalizeId(vote.creator) === currentNorm;
        if (!isMine) {
          // Temporary debug to diagnose why votes might not appear under "My Votes"
          console.debug('[useVotes] identity compare', {
            title: vote.title,
            creatorRaw: vote.creator,
            creatorStr: vote.creator?.toString?.(),
            creatorNorm: normalizeId(vote.creator),
            currentRaw: rawCurrent,
            currentNorm,
            isMine
          });
        }
        return isMine;
      });
      const publicVotesList = allVotes.filter(vote => {
        const creatorObj = creatorById.get(vote.id);
        const isMine = creatorObj ? deepEqual(creatorObj, idObj) : normalizeId(vote.creator) === currentNorm;
        return !isMine;
      });

      console.debug('[useVotes] built lists from RLS-filtered data', {
        totalReceived: allVotes.length,
        my: myVotesList.length,
        public: publicVotesList.length,
      });

      setMyVotes(myVotesList);
      setPublicVotes(publicVotesList);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error loading votes:', err);
      setError('Failed to load votes');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {

    const handleConnectionChange = (connected: boolean) => {
      if (connected) {
        // Wait a bit for subscriptions to load data
        setTimeout(updateVotes, 500);
      } else {
        setMyVotes([]);
        setPublicVotes([]);
        setIsLoading(false); // Don't keep loading forever if disconnected
        setError('Disconnected from server');
      }
    };

    spacetimeDB.onConnectionChange(handleConnectionChange);
    
    // Initial load if already connected
    if (spacetimeDB.connection && spacetimeDB.currentUser) {
      updateVotes();
    }

    // Set up SpacetimeDB subscription listeners for real-time updates
    if (spacetimeDB.connection) {
      // Listen for vote table changes
      spacetimeDB.connection.db.vote.onInsert((_ctx, row) => {
        console.log('Vote inserted - updating list', row);
        updateVotes();
      });
      
      spacetimeDB.connection.db.vote.onUpdate((_ctx, oldRow, newRow) => {
        console.log('Vote updated - updating list', oldRow, newRow);
        updateVotes();
      });
      
      spacetimeDB.connection.db.vote.onDelete((_ctx, row) => {
        console.log('Vote deleted - updating list', row);
        updateVotes();
      });

      // Listen for vote option changes
      spacetimeDB.connection.db.voteOption.onInsert((_ctx, row) => {
        console.log('Vote option inserted - updating list', row);
        updateVotes();
      });
      
      spacetimeDB.connection.db.voteOption.onUpdate((_ctx, oldRow, newRow) => {
        console.log('Vote option updated - updating list', oldRow, newRow);
        updateVotes();
      });
      
      spacetimeDB.connection.db.voteOption.onDelete((_ctx, row) => {
        console.log('Vote option deleted - updating list', row);
        updateVotes();
      });

      // Listen for approval changes (for approval voting)
      spacetimeDB.connection.db.approval.onInsert((_ctx, row) => {
        console.log('Approval inserted - updating list', row);
        updateVotes();
      });
      
      spacetimeDB.connection.db.approval.onDelete((_ctx, row) => {
        console.log('Approval deleted - updating list', row);
        updateVotes();
      });

      // Listen for judgment changes (for majority judgment voting)
      spacetimeDB.connection.db.judgment.onInsert((_ctx, row) => {
        console.log('Judgment inserted - updating list', row);
        updateVotes();
      });
      
      spacetimeDB.connection.db.judgment.onUpdate((_ctx, oldRow, newRow) => {
        console.log('Judgment updated - updating list', oldRow, newRow);
        updateVotes();
      });
      
      spacetimeDB.connection.db.judgment.onDelete((_ctx, row) => {
        console.log('Judgment deleted - updating list', row);
        updateVotes();
      });

      // Listen for MJ summary changes (server precomputed)
      try {
        const mjs = (spacetimeDB.connection.db as any).mjSummary;
        mjs.onInsert((_ctx: any, row: any) => {
          console.log('MJ summary inserted - updating list', row);
          updateVotes();
        });
        mjs.onUpdate((_ctx: any, oldRow: any, newRow: any) => {
          console.log('MJ summary updated - updating list', oldRow, newRow);
          updateVotes();
        });
        mjs.onDelete((_ctx: any, row: any) => {
          console.log('MJ summary deleted - updating list', row);
          updateVotes();
        });
      } catch (_) {
        // Older servers may not have mj_summary; ignore
      }
    }

    return () => {
      spacetimeDB.offConnectionChange(handleConnectionChange);
      
      // Clean up subscription listeners to prevent memory leaks
      if (spacetimeDB.connection) {
        // Note: SpacetimeDB should handle cleanup automatically when connection closes
        // but we could add specific cleanup here if needed
      }
    };
  }, [updateVotes]);

  // Also rebuild once when the initial subscription snapshot is applied
  // This ensures existing public votes are visible on first load even if
  // table listeners don't emit events for the initial snapshot.
  useEffect(() => {
    // If subscriptions are already applied (race condition), rebuild now
    if (spacetimeDB.subscriptionsApplied) {
      try { updateVotes(); } catch {}
    }
    const onApplied = () => {
      try { updateVotes(); } catch (e) { console.warn('useVotes: update onApplied failed', e); }
    };
    spacetimeDB.onSubscriptionsApplied(onApplied);
    return () => {
      try { spacetimeDB.offSubscriptionsApplied(onApplied); } catch {}
    };
  }, [updateVotes]);

  const refreshVotes = updateVotes;

  return {
    myVotes,
    publicVotes,
    isLoading,
    error,
    totalVotes: myVotes.length + publicVotes.length,
    refreshVotes
  };
};
