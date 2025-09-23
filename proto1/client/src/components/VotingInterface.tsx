import React, { useEffect, useMemo, useState } from 'react';
import { VoteWithOptions } from '../hooks/useVotes';
import { spacetimeDB } from '../lib/spacetimeClient';
import { Mention } from '../generated/mention_type';
import MajorityJudgmentGraph from './MajorityJudgmentGraph';

interface VotingInterfaceProps {
  vote: VoteWithOptions;
  onVoteCast?: () => void;
  onError?: (error: string) => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({ vote, onVoteCast, onError }) => {
  const [isVoting, setIsVoting] = useState(false);
  const [userApprovals, setUserApprovals] = useState<Set<string>>(new Set());
  const [userJudgments, setUserJudgments] = useState<Record<string, string>>({});

  // Initialize current user's approvals for this vote and live-sync via subscriptions
  useEffect(() => {
    if (!spacetimeDB.connection || !spacetimeDB.currentUser) {
      setUserApprovals(new Set());
      return;
    }

    const connection = spacetimeDB.connection;
    const currentIdentity = spacetimeDB.currentUser.identity;

    // Initial load from cache
    const initial = new Set<string>();
    for (const row of (connection.db as any).approval.iter() as Iterable<any>) {
      try {
        const sameVote = row.voteId?.toString() === BigInt(vote.id).toString();
        const sameVoter = row.voter?.toString?.() === currentIdentity;
        if (sameVote && sameVoter) {
          initial.add(String(row.optionId));
        }
      } catch (_) {
        // ignore
      }
    }
    setUserApprovals(initial);

    // Live updates: subscribe to approval table changes
    const onInsert = (_ctx: any, row: any) => {
      try {
        const sameVote = row.voteId?.toString() === BigInt(vote.id).toString();
        const sameVoter = row.voter?.toString?.() === currentIdentity;
        if (sameVote && sameVoter) {
          setUserApprovals(prev => new Set([...prev, String(row.optionId)]));
        }
      } catch (_) {
        // ignore
      }
    };

    const onDelete = (_ctx: any, row: any) => {
      try {
        const sameVote = row.voteId?.toString() === BigInt(vote.id).toString();
        const sameVoter = row.voter?.toString?.() === currentIdentity;
        if (sameVote && sameVoter) {
          setUserApprovals(prev => {
            const next = new Set(prev);
            next.delete(String(row.optionId));
            return next;
          });
        }
      } catch (_) {
        // ignore
      }
    };

    const approvalHandle = connection.db.approval;
    approvalHandle.onInsert(onInsert);
    approvalHandle.onDelete(onDelete);

    return () => {
      // Clean up listeners
      try {
        approvalHandle.removeOnInsert(onInsert);
        approvalHandle.removeOnDelete(onDelete);
      } catch (_) {
        // best-effort cleanup
      }
    };
  }, [vote.id]);

  const handleApprovalVote = async (optionId: string, approved: boolean) => {
    if (isVoting) return;
    
    setIsVoting(true);
    try {
      if (approved) {
        await spacetimeDB.call('approve', vote.id, optionId);
        // Optimistic UI update
        setUserApprovals(prev => new Set([...prev, optionId]));
      } else {
        await spacetimeDB.call('unapprove', vote.id, optionId);
        // Optimistic UI update
        setUserApprovals(prev => {
          const newSet = new Set(prev);
          newSet.delete(optionId);
          return newSet;
        });
      }
      
      if (onVoteCast) onVoteCast();
    } catch (error) {
      console.error('Error voting:', error);
      if (onError) onError('Failed to cast vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleJudgmentVote = async (optionId: string, mention: string) => {
    if (isVoting) return;
    
    setIsVoting(true);
    try {
      // Convert string to Mention tagged union
      const mentionValue = (Mention as any)[mention] as any;
      await spacetimeDB.call('castJudgment', optionId, mentionValue);
      setUserJudgments(prev => ({ ...prev, [optionId]: mention }));
      
      if (onVoteCast) onVoteCast();
    } catch (error) {
      console.error('Error casting judgment:', error);
      if (onError) onError('Failed to cast judgment. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const isApprovalVoting = vote.voting_system?.tag === 'Approval';
  const isMajorityJudgment = vote.voting_system?.tag === 'MajorityJudgment';

  // Derive approved/unapproved lists for tag UI
  const { approvedOptions, unapprovedOptions } = useMemo(() => {
    const approved: typeof vote.options = [];
    const unapproved: typeof vote.options = [];
    for (const opt of vote.options || []) {
      if (userApprovals.has(opt.id)) approved.push(opt);
      else unapproved.push(opt);
    }
    return { approvedOptions: approved, unapprovedOptions: unapproved };
  }, [vote.options, userApprovals]);

  if (!vote.options || vote.options.length === 0) {
    return <div>No voting options available.</div>;
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h3>Cast your vote:</h3>
      
      {isApprovalVoting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {approvedOptions && approvedOptions.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Your approvals</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {approvedOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleApprovalVote(option.id, false)}
                    disabled={isVoting}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '9999px',
                      border: '1px solid #22c55e',
                      background: 'rgba(34,197,94,0.15)',
                      color: '#16a34a',
                      cursor: isVoting ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 500
                    }}
                  >
                    ✓ {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Options</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {unapprovedOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleApprovalVote(option.id, true)}
                  disabled={isVoting}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--fg)',
                    cursor: isVoting ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMajorityJudgment && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {vote.options.map((option) => {
            const userJudgment = userJudgments[option.id];
            const judgmentCounts = option.judgment_counts || {
              ToReject: 0,
              Passable: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0
            };
            const totalJudgments = option.total_judgments || 0;
            
            return (
              <div key={option.id} style={{ position: 'relative' }}>
                <MajorityJudgmentGraph
                  optionLabel={option.label}
                  judgmentCounts={judgmentCounts}
                  totalJudgments={totalJudgments}
                />
                <div style={{ 
                  display: 'flex', 
                  gap: '4px', 
                  flexWrap: 'wrap',
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', width: '100%' }}>
                    Your judgment:
                  </div>
                  {['ToReject', 'Passable', 'Good', 'VeryGood', 'Excellent'].map((mention) => (
                    <button
                      key={mention}
                      onClick={() => handleJudgmentVote(option.id, mention)}
                      disabled={isVoting}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: userJudgment === mention ? '#3b82f6' : 'transparent',
                        color: userJudgment === mention ? 'white' : 'var(--fg)',
                        cursor: isVoting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {mention.replace(/([A-Z])/g, ' $1').trim()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isApprovalVoting && !isMajorityJudgment && (
        <div style={{ color: 'var(--muted)' }}>
          Unknown voting system: {vote.voting_system?.tag || 'undefined'}
        </div>
      )}
    </div>
  );
};

export default VotingInterface;
