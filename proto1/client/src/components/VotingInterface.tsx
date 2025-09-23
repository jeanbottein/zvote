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

  // ----- Majority Judgment helpers -----
  const mentionOrder: Record<string, number> = {
    ToReject: 1,
    Passable: 2,
    Good: 3,
    VeryGood: 4,
    Excellent: 5,
  };

  // Note: do NOT sort MJ sliders; we keep original option order for voting UX

  // Load current user's judgments and live-sync
  useEffect(() => {
    if (!spacetimeDB.connection || !spacetimeDB.currentUser) {
      setUserJudgments({});
      return;
    }
    const connection = spacetimeDB.connection;
    const currentIdentity = spacetimeDB.currentUser.identity;

    const init: Record<string, string> = {};
    for (const row of (connection.db as any).judgment.iter() as Iterable<any>) {
      try {
        const sameVoter = row.voter?.toString?.() === currentIdentity;
        if (sameVoter) {
          init[String(row.optionId)] = row.mention?.tag;
        }
      } catch (_) {}
    }
    setUserJudgments(init);

    const onInsert = (_ctx: any, row: any) => {
      try {
        if (row.voter?.toString?.() === currentIdentity) {
          setUserJudgments(prev => ({ ...prev, [String(row.optionId)]: row.mention?.tag }));
        }
      } catch (_) {}
    };
    const onUpdate = (_ctx: any, _oldRow: any, newRow: any) => {
      try {
        if (newRow.voter?.toString?.() === currentIdentity) {
          setUserJudgments(prev => ({ ...prev, [String(newRow.optionId)]: newRow.mention?.tag }));
        }
      } catch (_) {}
    };
    const onDelete = (_ctx: any, row: any) => {
      try {
        if (row.voter?.toString?.() === currentIdentity) {
          setUserJudgments(prev => {
            const next = { ...prev };
            delete next[String(row.optionId)];
            return next;
          });
        }
      } catch (_) {}
    };
    const h = connection.db.judgment;
    h.onInsert(onInsert);
    h.onUpdate(onUpdate);
    h.onDelete(onDelete);
    return () => {
      try {
        h.removeOnInsert(onInsert);
        h.removeOnUpdate(onUpdate);
        h.removeOnDelete(onDelete);
      } catch (_) {}
    };
  }, [vote.id]);

  // Visibility badge style (same as App.tsx)
  const getVisibilityBadgeStyle = (visibilityTag?: string): React.CSSProperties => {
    switch (visibilityTag) {
      case 'Public':
        return { backgroundColor: '#15803d', color: 'white' };
      case 'Unlisted':
        return { backgroundColor: '#b45309', color: 'white' };
      case 'Private':
        return { backgroundColor: '#dc2626', color: 'white' };
      default:
        return {};
    }
  };

  if (!vote.options || vote.options.length === 0) {
    return <div>No voting options available.</div>;
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {/* Visibility tag */}
        <div className="badge" style={getVisibilityBadgeStyle(vote.visibility?.tag)}>
          {vote.visibility?.tag || (vote.public ? 'Public' : 'Private')}
        </div>
        {/* Total judgments tag (green) */}
        {isMajorityJudgment && (
          <div className="badge" style={{ backgroundColor: '#16a34a', color: 'white' }}>
            {Math.max(0, ...((vote.options || []).map(o => o.total_judgments || 0)))} judgments
          </div>
        )}
      </div>

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
          {(vote.options || []).map((option) => {
            const userJudgment = userJudgments[option.id];

            // Slider value mapping 0..4
            const sliderValue = userJudgment ? (mentionOrder[userJudgment] - 1) : 2; // default mid

            const mentionKeys: Array<keyof typeof mentionOrder> = ['ToReject','Passable','Good','VeryGood','Excellent'];
            const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();
            const trackGradient = colorMode === 'colorblind'
              ? 'linear-gradient(90deg, #1f2937 0%, #4b5563 25%, #9ca3af 50%, #d1d5db 75%, #ffffff 100%)'
              : 'linear-gradient(90deg, #dc2626 0%, #f97316 25%, #facc15 50%, #4ade80 75%, #16a34a 100%)';

            return (
              <div key={option.id} style={{ position: 'relative', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 500, marginBottom: '8px' }}>{option.label}</div>

                {/* Slider voting only (no results) */}
                <div style={{ position: 'relative' }}>
                  {/* Ticks above the slider */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    {mentionKeys.map((m) => (
                      <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20%' }}>
                        <div style={{ width: '2px', height: '10px', background: 'var(--border)' }} />
                      </div>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const mention = mentionKeys[val] as string;
                      handleJudgmentVote(option.id, mention);
                    }}
                    disabled={isVoting}
                    style={{
                      width: '100%',
                      appearance: 'none',
                      height: '8px',
                      borderRadius: '9999px',
                      background: trackGradient,
                      outline: 'none',
                    }}
                  />
                  {/* Custom thumb styling */}
                  <style>{`
                    input[type="range"]::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #111;
                      border: 2px solid white;
                      box-shadow: 0 0 0 2px #111;
                      cursor: pointer;
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #111;
                      border: 2px solid white;
                      box-shadow: 0 0 0 2px #111;
                      cursor: pointer;
                    }
                  `}</style>

                  {/* Mention labels under the slider, clickable to set value */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
                    {mentionKeys.map((m, idx) => {
                      const selected = sliderValue === idx;
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
                            border: '1px solid var(--border)',
                            background: selected ? 'var(--accent-solid)' : 'transparent',
                            color: selected ? '#0b0b0b' : 'var(--fg)',
                            cursor: isVoting ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
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
