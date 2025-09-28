import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { spacetimeDB } from '../lib/spacetimeClient';
import BallotInterface from '../features/BallotInterface/BallotInterface';
import MajorityJudgmentResultsGraph from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph';
import { useToast } from '../components/ToastProvider';
import DevBallotFeeder from '../components/DevBallotFeeder';
import { rankOptions } from '../utils/majorityJudgment';

const JudgmentVotePage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { vote, loading, error } = useVoteByToken(token);
  const { showToast } = useToast();

  useEffect(() => {
    if (token) {
      console.log('[JudgmentVotePage] Setting up focused subscription for token:', token);
      // Wait for connection and initial subscriptions before applying focused ones
      const tryFocus = async () => {
        if (spacetimeDB.connection && spacetimeDB.subscriptionsApplied) {
          console.log('[JudgmentVotePage] Applying focused subscription now');
          try {
            await spacetimeDB.setFocusedVoteByToken(token);
            console.log('[JudgmentVotePage] Focused subscription completed successfully');
          } catch (e) {
            console.error('[JudgmentVotePage] Focused subscription failed:', e);
          }
        } else {
          console.log('[JudgmentVotePage] Waiting for connection/subscriptions...', {
            connected: !!spacetimeDB.connection,
            subsApplied: spacetimeDB.subscriptionsApplied
          });
          setTimeout(tryFocus, 100);
        }
      };
      tryFocus();
    }
  }, [token]);

  if (!token) {
    return <div className="panel"><h2>Missing token</h2></div>;
  }
  if (loading) {
    return <div className="panel"><h2>Loading vote…</h2></div>;
  }
  if (error) {
    return <div className="panel"><h2>Error</h2><div style={{color:'var(--muted)'}}>{error}</div></div>;
  }
  if (!vote) {
    return <div className="panel"><h2>Vote not found</h2></div>;
  }

  // Build sorted options by MJ ranking with ranks (winners first)
  const rankedOptions = rankOptions(vote.options || []);

  // Find winners (all tied for first)
  const winners = new Set(rankedOptions.filter(opt => opt.mjAnalysis.rank === 1).map(opt => opt.id));

  // Check if there are any votes/ballots submitted
  const totalBallots = Math.max(...(vote.options || []).map(option => option.total_judgments || 0));
  const hasVotes = totalBallots > 0;

  return (
    <div className="panel">
            <div className="vote-page-header">
        <h2>{vote.title}</h2>
        <div className="ballot-count-badge">
          <span className="ballot-count-number">{totalBallots}</span>
          <span className="ballot-count-label">{totalBallots === 1 ? 'ballot' : 'ballots'}</span>
        </div>
      </div>
      
      {/* Always show results section, even when empty */}
      <div style={{ marginTop: '16px' }}>
        {rankedOptions.map((option: any) => (
          <MajorityJudgmentResultsGraph
            key={option.id}
            optionLabel={option.label}
            judgmentCounts={option.judgment_counts || {
              ToReject: 0,
              Insufficient: 0,
              OnlyAverage: 0,
              GoodEnough: 0,
              Good: 0,
              VeryGood: 0,
              Excellent: 0
            }}
            totalBallots={option.total_judgments || 0}
            compact={false}
            showSecond={hasVotes && winners.size > 1 && winners.has(option.id)}
            rank={hasVotes ? option.mjAnalysis.rank : undefined}
            isExAequo={hasVotes && rankedOptions.filter(opt => opt.mjAnalysis.rank === option.mjAnalysis.rank).length > 1}
          />
        ))}
      </div>

      <BallotInterface 
        vote={vote}
        onBallotSubmitted={() => {}} // No success toast
        onError={(msg: string) => showToast({ type: 'error', message: msg })}
      />

      {/* DEV ONLY: Ballot Feeder Tool. Remove this line to hide it. */}
      <DevBallotFeeder vote={vote} />
    </div>
  );
};

export default JudgmentVotePage;
