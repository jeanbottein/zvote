import React, { useState } from 'react';
import { VoteWithOptions } from '../hooks/useVotes';
import { spacetimeDB } from '../lib/spacetimeClient';
import { Mention } from '../generated/mention_type';
import ApprovalVotingDisplay from './ApprovalVotingDisplay';
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

  const handleApprovalVote = async (optionId: string, approved: boolean) => {
    if (isVoting) return;
    
    setIsVoting(true);
    try {
      if (approved) {
        await spacetimeDB.call('approve', vote.id, optionId);
        setUserApprovals(prev => new Set([...prev, optionId]));
      } else {
        await spacetimeDB.call('unapprove', vote.id, optionId);
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

  if (!vote.options || vote.options.length === 0) {
    return <div>No voting options available.</div>;
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h3>Cast your vote:</h3>
      
      {isApprovalVoting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {vote.options.map((option) => {
            const isApproved = userApprovals.has(option.id);
            const totalVoters = vote.options?.reduce((sum, opt) => 
              Math.max(sum, opt.approvals_count || 0), 0) || option.approvals_count || 0;
            
            return (
              <div key={option.id} style={{ position: 'relative' }}>
                <ApprovalVotingDisplay
                  optionLabel={option.label}
                  approvalsCount={option.approvals_count || 0}
                  totalVoters={totalVoters}
                  isApproved={isApproved}
                />
                <button
                  onClick={() => handleApprovalVote(option.id, !isApproved)}
                  disabled={isVoting}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: isApproved ? '#22c55e' : 'var(--accent-solid)',
                    color: isApproved ? 'white' : '#0b0b0b',
                    cursor: isVoting ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  {isApproved ? '✓ Approved' : 'Approve'}
                </button>
              </div>
            );
          })}
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
