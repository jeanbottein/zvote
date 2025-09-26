import React, { useState } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';
import { Mention } from '../../../generated/mention_type';

interface MajorityJudgmentBallotInterfaceProps {
  voteId: string;
  options: Array<{ id: string; label: string }>;
  userJudgments: Record<string, string>;
  onBallotSubmitted?: () => void;
  onJudgmentChanged?: (optionId: string, mention: string) => void;
  onJudgmentsWithdrawn?: () => void;
  onError?: (error: string) => void;
}

const MajorityJudgmentBallotInterface: React.FC<MajorityJudgmentBallotInterfaceProps> = ({
  voteId,
  options,
  userJudgments,
  onBallotSubmitted,
  onJudgmentChanged,
  onJudgmentsWithdrawn,
  onError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 7-level mentions best-to-worst (for UI header left-to-right)
  const mentionKeys = ['Excellent','VeryGood','Good','GoodEnough','OnlyAverage','Insufficient','ToReject'] as const;
  const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();

  const handleJudgmentSubmit = async (optionId: string, mention: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Check if this is the user's first judgment for this vote
      const isFirstJudgment = Object.keys(userJudgments).length === 0;

      // Convert string to Mention tagged union and send to server
      const mentionValue = (Mention as any)[mention] as any;
      await spacetimeDB.call('submit_judgment_ballot', optionId, mentionValue);

      if (isFirstJudgment) {
        // Server automatically set all options to ToReject, then updated this specific one
        for (const option of options) {
          if (option.id === optionId) {
            if (onJudgmentChanged) onJudgmentChanged(option.id, mention);
          } else {
            if (onJudgmentChanged) onJudgmentChanged(option.id, 'ToReject');
          }
        }
      } else {
        if (onJudgmentChanged) onJudgmentChanged(optionId, mention);
      }
      
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error submitting judgment:', error);
      if (onError) onError('Failed to submit judgment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawBallot = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await spacetimeDB.call('withdrawJudgments', voteId);
      
      // Notify parent that all judgments were withdrawn
      if (onJudgmentsWithdrawn) onJudgmentsWithdrawn();
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error withdrawing ballot:', error);
      if (onError) onError('Failed to withdraw your ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSubmittedBallot = Object.keys(userJudgments).length > 0;

  return (
    <div id={`mj-ballot-${voteId}`} className="ballot-interface">
      <div id={`mj-ballot-header-${voteId}`} className="ballot-header">
        <div id={`mj-ballot-label-${voteId}`} className="ballot-label">Your ballot</div>
        {hasSubmittedBallot && (
          <button
            onClick={handleWithdrawBallot}
            disabled={isSubmitting}
            className="btn-danger"
            title="Withdraw your entire ballot for this vote"
          >
            Withdraw ballot
          </button>
        )}
      </div>

      <table className="mj-ballot-table">
        <thead>
          <tr>
            <th>Option</th>
            {mentionKeys.map((m) => (
              <th key={m}>{mentionLabel(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((option) => {
            const userJudgment = userJudgments[String(option.id)];
            return (
              <tr key={option.id}>
                <td className="mj-option-title">{option.label}</td>
                {mentionKeys.map((m) => {
                  const selected = userJudgment === (m as string);
                  return (
                    <td key={m}>
                      <button
                        type="button"
                        className="mj-cell-btn"
                        data-selected={selected ? 'true' : 'false'}
                        data-mention={m as string}
                        disabled={isSubmitting}
                        onClick={() => handleJudgmentSubmit(option.id, m as string)}
                        title={mentionLabel(m)}
                      >
                        {selected ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MajorityJudgmentBallotInterface;
