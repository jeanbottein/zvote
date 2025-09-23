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
      const allVotes: VoteWithOptions[] = [];
      
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
            // Count approvals for this option
            let approvalsCount = 0;
            for (const approval of (spacetimeDB.connection.db as any).approval.iter() as Iterable<any>) {
              if (approval.optionId?.toString() === option.id.toString()) {
                approvalsCount++;
              }
            }

            // Count judgments for this option (for majority judgment)
            const judgmentCounts = {
              ToReject: 0,
              Passable: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0
            };
            
            for (const judgment of (spacetimeDB.connection.db as any).judgment.iter() as Iterable<any>) {
              if (judgment.optionId?.toString() === option.id.toString()) {
                const mention = judgment.mention?.tag;
                if (mention && judgmentCounts.hasOwnProperty(mention)) {
                  judgmentCounts[mention as keyof typeof judgmentCounts]++;
                }
              }
            }

            options.push({
              id: option.id.toString(),
              label: option.label,
              approvals_count: approvalsCount,
              judgment_counts: judgmentCounts,
              total_judgments: Object.values(judgmentCounts).reduce((a, b) => a + b, 0)
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
      const currentUserIdentity = spacetimeDB.currentUser.identity.toString();
      const myVotesList = allVotes.filter(vote => vote.creator === currentUserIdentity);
      const publicVotesList = allVotes.filter(vote => vote.public && vote.creator !== currentUserIdentity);

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
