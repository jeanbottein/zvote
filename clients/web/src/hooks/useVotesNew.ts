/**
 * useVotes Hook - Backend Abstraction Version
 * 
 * Uses the backend abstraction layer instead of direct SpacetimeDB access.
 * Works with both SpacetimeDB and GraphQL backends.
 */

import { useState, useEffect, useCallback } from 'react';
import { getBackend } from '../lib/backend';
import type { Vote } from '../lib/backend/BackendAPI';

export const useVotes = () => {
  const [myVotes, setMyVotes] = useState<Vote[]>([]);
  const [publicVotes, setPublicVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backend = await getBackend();
      const allVotes = await backend.getVotes();
      const currentUserId = backend.getCurrentUserId();

      // Split into my votes and public votes
      const my = currentUserId ? allVotes.filter(v => v.creatorId === currentUserId) : [];
      const pub = allVotes.filter(v => v.visibility === 'Public');

      setMyVotes(my);
      setPublicVotes(pub);
    } catch (err) {
      console.error('[useVotes] Error loading votes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load votes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVotes();

    // Subscribe to real-time updates
    let unsubscribe: (() => void) | null = null;

    getBackend().then(backend => {
      unsubscribe = backend.onVotesChange(votes => {
        const currentUserId = backend.getCurrentUserId();
        const my = currentUserId ? votes.filter(v => v.creatorId === currentUserId) : [];
        const pub = votes.filter(v => v.visibility === 'Public');
        setMyVotes(my);
        setPublicVotes(pub);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadVotes]);

  return {
    myVotes,
    publicVotes,
    isLoading,
    error,
    refreshVotes: loadVotes,
  };
};
