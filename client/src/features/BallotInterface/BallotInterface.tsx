import React, { useEffect, useState } from 'react';
import { VoteWithOptions } from '../../hooks/useVotes';
import { spacetimeDB } from '../../lib/spacetimeClient';
import ApprovalBallotInterface from '../VotingSystem/ApprovalVoting/ApprovalBallotInterface';
import MajorityJudgmentBallotInterface from '../VotingSystem/MajorityJudgment/MajorityJudgmentBallotInterface';

interface BallotInterfaceProps {
  vote: VoteWithOptions;
  onBallotSubmitted?: () => void;
  onError?: (error: string) => void;
}

const BallotInterface: React.FC<BallotInterfaceProps> = ({ vote, onBallotSubmitted, onError }) => {
  const [userApprovals, setUserApprovals] = useState<Set<string>>(new Set());
  const [userJudgments, setUserJudgments] = useState<Record<string, string>>({});

  // Initialize current user's approvals from localStorage (since private tables aren't accessible)
  useEffect(() => {
    if (!spacetimeDB.currentUser) {
      setUserApprovals(new Set());
      return;
    }

    const storageKey = `approvals_${spacetimeDB.currentUser.identity}_${vote.id}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const approvals = JSON.parse(stored) as string[];
        setUserApprovals(new Set(approvals));
      }
    } catch (e) {
      console.warn('Failed to load approvals from localStorage:', e);
    }
  }, [vote.id, spacetimeDB.currentUser?.identity]);

  // Save approvals to localStorage whenever they change
  useEffect(() => {
    if (!spacetimeDB.currentUser) return;
    
    const storageKey = `approvals_${spacetimeDB.currentUser.identity}_${vote.id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...userApprovals]));
    } catch (e) {
      console.warn('Failed to save approvals to localStorage:', e);
    }
  }, [userApprovals, vote.id, spacetimeDB.currentUser?.identity]);

  // Initialize current user's judgments from localStorage
  useEffect(() => {
    if (!spacetimeDB.currentUser) {
      setUserJudgments({});
      return;
    }

    const storageKey = `judgments_${spacetimeDB.currentUser.identity}_${vote.id}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const judgments = JSON.parse(stored) as Record<string, string>;
        setUserJudgments(judgments);
      } else {
        setUserJudgments({});
      }
    } catch (e) {
      console.warn('Failed to load judgments from localStorage:', e);
      setUserJudgments({});
    }
  }, [vote.id, spacetimeDB.currentUser?.identity]);

  // Save judgments to localStorage whenever they change
  useEffect(() => {
    if (!spacetimeDB.currentUser) return;
    
    const storageKey = `judgments_${spacetimeDB.currentUser.identity}_${vote.id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(userJudgments));
    } catch (e) {
      console.warn('Failed to save judgments to localStorage:', e);
    }
  }, [userJudgments, vote.id, spacetimeDB.currentUser?.identity]);

  const handleApprovalChanged = (optionId: string, approved: boolean) => {
    // Update localStorage and local state immediately
    setUserApprovals(prev => {
      const updated = new Set(prev);
      if (approved) {
        updated.add(optionId);
      } else {
        updated.delete(optionId);
      }
      
      // Save to localStorage
      if (spacetimeDB.currentUser) {
        const storageKey = `approvals_${spacetimeDB.currentUser.identity}_${vote.id}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify([...updated]));
        } catch (e) {
          console.warn('Failed to save approval to localStorage:', e);
        }
      }
      
      return updated;
    });
  };

  const handleApprovalsWithdrawn = () => {
    // Clear all approvals from localStorage and local state
    setUserApprovals(new Set());
    
    if (spacetimeDB.currentUser) {
      const storageKey = `approvals_${spacetimeDB.currentUser.identity}_${vote.id}`;
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Failed to clear approvals from localStorage:', e);
      }
    }
  };

  const handleJudgmentChanged = (optionId: string, mention: string) => {
    // Update localStorage and local state immediately
    setUserJudgments(prev => {
      const updated = { ...prev, [optionId]: mention };
      
      // Save to localStorage
      if (spacetimeDB.currentUser) {
        const storageKey = `judgments_${spacetimeDB.currentUser.identity}_${vote.id}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save judgment to localStorage:', e);
        }
      }
      
      return updated;
    });
  };

  const handleJudgmentsWithdrawn = () => {
    // Clear all judgments from localStorage and local state
    setUserJudgments({});
    
    if (spacetimeDB.currentUser) {
      const storageKey = `judgments_${spacetimeDB.currentUser.identity}_${vote.id}`;
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Failed to clear judgments from localStorage:', e);
      }
    }
  };

  const handleBallotSubmitted = () => {
    if (onBallotSubmitted) onBallotSubmitted();
  };

  const isApprovalVoting = vote.voting_system?.tag === 'Approval';
  const isMajorityJudgment = vote.voting_system?.tag === 'MajorityJudgment';

  if (!vote.options || vote.options.length === 0) {
    return <div>No ballot options available.</div>;
  }

  return (
    <div id={`ballot-interface-${vote.id}`} className="ballot">
      {isApprovalVoting && (
        <ApprovalBallotInterface
          voteId={vote.id}
          voteTitle={vote.title}
          options={vote.options}
          userApprovals={userApprovals}
          onBallotSubmitted={handleBallotSubmitted}
          onApprovalChanged={handleApprovalChanged}
          onApprovalsWithdrawn={handleApprovalsWithdrawn}
          onError={onError}
        />
      )}

      {isMajorityJudgment && (
        <MajorityJudgmentBallotInterface
          voteId={vote.id}
          voteTitle={vote.title}
          options={vote.options}
          userJudgments={userJudgments}
          onBallotSubmitted={handleBallotSubmitted}
          onJudgmentChanged={handleJudgmentChanged}
          onJudgmentsWithdrawn={handleJudgmentsWithdrawn}
          onError={onError}
        />
      )}

      {!isApprovalVoting && !isMajorityJudgment && (
        <div id={`ballot-unknown-${vote.id}`} className="ballot-section-hint">
          Unknown voting system: {vote.voting_system?.tag || 'undefined'}
        </div>
      )}
    </div>
  );
};

export default BallotInterface;
