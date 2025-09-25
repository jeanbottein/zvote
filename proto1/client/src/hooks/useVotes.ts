import { useState, useEffect, useCallback } from 'react';
import { spacetimeDB } from '../lib/spacetimeClient';
import { VotingSystem } from '../generated/voting_system_type';
import { Visibility } from '../generated/visibility_type';

// Extended vote type with options and backward compatibility
export interface VoteWithOptions {
  id: string;
  creator: string; // Convert Identity to string for compatibility
  title: string;
  public: boolean; // Computed from visibility for backward compatibility
  visibility: Visibility;
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
      ToReject: number;
      Passable: number;
      Good: number;
      VeryGood: number;
      Excellent: number;
    };
    total_judgments?: number;
    majority_tag?: string | null;
    second_tag?: string | null;
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
          creator: vote.creator.toString(), // Convert Identity to string
          title: vote.title,
          public: vote.visibility?.tag === 'Public', // Convert visibility to boolean
          visibility: vote.visibility,
          created_at: Number(vote.createdAt || 0),
          createdAt: Number(vote.createdAt || 0),
          token: vote.token || '',
          voting_system: vote.votingSystem,
          votingSystem: vote.votingSystem,
          options: []
        };

        // Get options for this vote
        const options: any[] = [];
        for (const option of (spacetimeDB.connection.db as any).voteOption.iter() as Iterable<any>) {
          if (option.voteId?.toString() === vote.id.toString()) {
            // Use server-maintained aggregates
            const approvalsCount = Number(option.approvalsCount || 0);
            // Majority Judgment counts: use mj_summary only (privacy-safe)
            let judgmentCounts = {
              ToReject: 0,
              Passable: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0
            } as Record<string, number>;
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
            }

            options.push({
              id: option.id.toString(),
              label: option.label,
              approvals_count: approvalsCount,
              judgment_counts: judgmentCounts,
              total_judgments: totalJudgments,
              majority_tag: sumRow?.majority?.tag ?? null,
              second_tag: sumRow?.second?.tag ?? null
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

      // Separate my votes from public votes
      const normalizeId = (s: string) => s.toLowerCase().replace(/^identity\(0x/,'0x').replace(/\)$/,'').replace(/^0x/,'');
      const currentUserIdentity = spacetimeDB.currentUser.identity.toString();
      const currentNorm = normalizeId(currentUserIdentity);
      const focusedId = spacetimeDB.focusedVoteId;
      const myVotesList = allVotes.filter(vote => normalizeId(vote.creator) === currentNorm);
      const publicVotesList = allVotes.filter(vote => {
        const isMine = normalizeId(vote.creator) === currentNorm;
        const isPublic = vote.public;
        const isFocused = focusedId ? vote.id === focusedId : false;
        return (!isMine && (isPublic || isFocused));
      });

      console.debug('[useVotes] built lists', {
        all: allVotes.length,
        my: myVotesList.length,
        pub: publicVotesList.length,
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
