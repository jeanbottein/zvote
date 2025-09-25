import React, { useEffect, useMemo, useState } from 'react';
import { VoteWithOptions } from '../hooks/useVotes';
import { spacetimeDB } from '../lib/spacetimeClient';
import { Mention } from '../generated/mention_type';
import { getColorMode, onColorModeChange } from '../lib/colorMode';

interface VotingInterfaceProps {
  vote: VoteWithOptions;
  onVoteCast?: () => void;
  onError?: (error: string) => void;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({ vote, onVoteCast, onError }) => {
  const [isVoting, setIsVoting] = useState(false);
  const [userApprovals, setUserApprovals] = useState<Set<string>>(new Set());
  const [userJudgments, setUserJudgments] = useState<Record<string, string>>({});
  const [colorMode, setColorMode] = useState(getColorMode());

  useEffect(() => {
    const off = onColorModeChange(setColorMode);
    return () => off?.();
  }, []);

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
      // Optimistic UI: mirror server behavior on first judgment
      setUserJudgments(prev => {
        const next = { ...prev } as Record<string, string>;
        const isFirst = Object.keys(prev).length === 0;
        if (isFirst) {
          for (const opt of (vote.options || [])) {
            next[String(opt.id)] = 'ToReject';
          }
        }
        next[String(optionId)] = mention;
        return next;
      });

      // Convert string to Mention tagged union and send to server
      const mentionValue = (Mention as any)[mention] as any;
      await spacetimeDB.call('castJudgment', optionId, mentionValue);
      if (onVoteCast) onVoteCast();
    } catch (error) {
      console.error('Error casting judgment:', error);
      if (onError) onError('Failed to cast judgment. Please try again.');
      // Best-effort resync from local cache on error
      if (spacetimeDB.connection && spacetimeDB.currentUser) {
        try {
          const connection = spacetimeDB.connection;
          const currentIdentity = spacetimeDB.currentUser.identity;
          
          // Same identity matching logic as in the effect
          const isMyVote = (voter: any): boolean => {
            if (!voter) return false;
            const voterStr = voter.toString?.() || '';
            if (voterStr === currentIdentity) return true;
            const match = voterStr.match(/Identity\(0x([a-f0-9]+)\)/i);
            if (match && match[1]) {
              return match[1].toLowerCase() === currentIdentity.toLowerCase();
            }
            const hexMatch = voterStr.match(/([a-f0-9]{40,})/i);
            if (hexMatch && hexMatch[1]) {
              return hexMatch[1].toLowerCase() === currentIdentity.toLowerCase();
            }
            return false;
          };
          
          const newJudgments: Record<string, string> = {};
          for (const row of (connection.db as any).judgment.iter() as Iterable<any>) {
            try {
              if (isMyVote(row.voter)) {
                newJudgments[String(row.optionId)] = row.mention?.tag;
              }
            } catch (_) {}
          }
          setUserJudgments(newJudgments);
        } catch (_) {}
      }
    } finally {
      setIsVoting(false);
    }
  };

  const handleWithdrawMJ = async () => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      await spacetimeDB.call('withdrawJudgments', vote.id);
      // Clear local state for this vote
      setUserJudgments({});
      if (onVoteCast) onVoteCast();
    } catch (error) {
      console.error('Error withdrawing judgments:', error);
      if (onError) onError('Failed to withdraw your judgments. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const isApprovalVoting = vote.voting_system?.tag === 'Approval';
  const isMajorityJudgment = vote.voting_system?.tag === 'MajorityJudgment';

  // Check if user has voted (either approvals or judgments)
  const hasUserVoted = useMemo(() => {
    if (isApprovalVoting) {
      return userApprovals.size > 0;
    }
    if (isMajorityJudgment) {
      return Object.keys(userJudgments).length > 0;
    }
    return false;
  }, [isApprovalVoting, isMajorityJudgment, userApprovals.size, userJudgments]);

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

  // ----- Majority Judgment helpers -----
  const mentionOrder: Record<string, number> = {
    ToReject: 1,
    Passable: 2,
    Good: 3,
    VeryGood: 4,
    Excellent: 5,
  };

  // Note: do NOT sort MJ sliders; we keep original option order for voting UX

  // Initialize current user's judgments from localStorage (since private tables aren't accessible)
  useEffect(() => {
    if (!spacetimeDB.currentUser) {
      console.log('[VotingInterface] No current user, clearing judgments');
      setUserJudgments({});
      return;
    }

    const storageKey = `judgments_${spacetimeDB.currentUser.identity}_${vote.id}`;
    console.log('[VotingInterface] Loading judgments from localStorage with key:', storageKey);
    
    try {
      const stored = localStorage.getItem(storageKey);
      console.log('[VotingInterface] Stored judgments:', stored);
      
      if (stored) {
        const judgments = JSON.parse(stored) as Record<string, string>;
        console.log('[VotingInterface] Parsed judgments:', judgments);
        setUserJudgments(judgments);
      } else {
        console.log('[VotingInterface] No stored judgments found');
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


  if (!vote.options || vote.options.length === 0) {
    return <div>No voting options available.</div>;
  }

  return (
    <div style={{ marginTop: '16px' }}>

      {isApprovalVoting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {hasUserVoted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  if (isVoting) return;
                  setIsVoting(true);
                  try {
                    // Remove all user's approvals for this vote
                    for (const optionId of userApprovals) {
                      await spacetimeDB.call('unapprove', vote.id, optionId);
                    }
                    setUserApprovals(new Set());
                    if (onVoteCast) onVoteCast();
                  } catch (error) {
                    console.error('Error withdrawing approvals:', error);
                    if (onError) onError('Failed to withdraw your approvals. Please try again.');
                  } finally {
                    setIsVoting(false);
                  }
                }}
                disabled={isVoting}
                className="btn-danger"
                title="Remove all your approvals for this vote"
              >
                Withdraw my vote
              </button>
            </div>
          )}

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
          {hasUserVoted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleWithdrawMJ}
                disabled={isVoting}
                className="btn-danger"
                title="Remove all your judgments for this vote"
              >
                Withdraw my vote
              </button>
            </div>
          )}
          {(vote.options || []).map((option) => {
            const userJudgment = userJudgments[String(option.id)];

            // Slider value mapping 0..4 - no default selection if user hasn't voted
            const sliderValue = userJudgment ? (mentionOrder[userJudgment] - 1) : -1; // no default selection

            const mentionKeys: Array<keyof typeof mentionOrder> = ['ToReject','Passable','Good','VeryGood','Excellent'];
            const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();
            const trackGradient = colorMode === 'colorblind'
              ? 'linear-gradient(90deg, #1f2937 0%, #4b5563 25%, #9ca3af 50%, #d1d5db 75%, #ffffff 100%)'
              : 'linear-gradient(90deg, #dc2626 0%, #f97316 25%, #facc15 50%, #4ade80 75%, #16a34a 100%)';
            
            // Get color for each mention
            const getMentionColor = (mentionKey: string) => {
              if (colorMode === 'colorblind') {
                const grayColors = ['#1f2937', '#4b5563', '#9ca3af', '#d1d5db', '#ffffff'];
                const index = mentionKeys.indexOf(mentionKey as keyof typeof mentionOrder);
                return grayColors[index] || '#9ca3af';
              } else {
                const colors = ['#dc2626', '#f97316', '#facc15', '#4ade80', '#16a34a'];
                const index = mentionKeys.indexOf(mentionKey as keyof typeof mentionOrder);
                return colors[index] || '#facc15';
              }
            };

            return (
              <div key={option.id} style={{ position: 'relative', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 500, marginBottom: '8px' }}>{option.label}</div>

                {/* Slider voting only (no results) */}
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    {/* Tick marks behind the slider */}
                    {mentionKeys.map((m, idx) => {
                      const tickPositions = [10, 30, 50, 70, 90];
                      return (
                        <div 
                          key={m} 
                          style={{ 
                            position: 'absolute', 
                            left: `${tickPositions[idx]}%`, 
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '2px', 
                            height: '42px', 
                            background: 'var(--border)',
                            zIndex: 1
                          }} 
                        />
                      );
                    })}

                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={sliderValue >= 0 ? sliderValue : 2}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const mention = mentionKeys[val] as string;
                        handleJudgmentVote(option.id, mention);
                      }}
                      disabled={isVoting}
                      className="mj-slider"
                      style={{
                        width: '100%',
                        appearance: 'none',
                        height: '8px',
                        borderRadius: '9999px',
                        background: trackGradient,
                        outline: 'none',
                        margin: '0',
                        position: 'relative',
                        zIndex: 5,
                      }}
                    />
                    {/* Custom thumb - show only when user has voted */}
                    {sliderValue >= 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: `${[10, 30, 50, 70, 90][sliderValue]}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#fff',
                          border: '2px solid #333',
                          boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
                          pointerEvents: 'none',
                          zIndex: 10,
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Hide native thumb; we render our own aligned dot */}
                  <style>{`
                    .mj-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 0; height: 0; background: transparent; border: none; }
                    .mj-slider::-moz-range-thumb { width: 0; height: 0; background: transparent; border: none; }
                    .mj-slider::-webkit-slider-runnable-track {
                      height: 8px;
                      border-radius: 9999px;
                      background: transparent;
                    }
                    .mj-slider::-moz-range-track {
                      height: 8px;
                      border-radius: 9999px;
                      background: transparent;
                    }
                  `}</style>

                  {/* Mention labels under the slider, clickable to set value */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
                    {mentionKeys.map((m) => {
                      const selected = userJudgment === (m as string);
                      const mentionColor = getMentionColor(m);
                      return (
                        <button
                          key={m}
                          onClick={() => handleJudgmentVote(option.id, m as string)}
                          disabled={isVoting}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '11px',
                            borderRadius: '9999px',
                            border: selected ? `2px solid ${mentionColor}` : '1px solid var(--border)',
                            background: selected ? mentionColor : 'transparent',
                            color: selected ? (colorMode === 'colorblind' && (m === 'VeryGood' || m === 'Excellent') ? '#000' : '#fff') : 'var(--fg)',
                            cursor: isVoting ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                            fontWeight: selected ? 700 : 500,
                          }}
                          title={mentionLabel(m)}
                        >
                          {mentionLabel(m)}
                        </button>
                      );
                    })}
                  </div>
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
