import React, { useState } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';
import { Mention } from '../../../generated/mention_type';

interface MajorityJudgmentBallotFormViewProps {
  voteId: string;
  voteTitle: string;
  options: Array<{ id: string; label: string }>;
  userJudgments: Record<string, string>;
  onBallotSubmitted?: () => void;
  onJudgmentChanged?: (optionId: string, mention: string) => void;
  onJudgmentsWithdrawn?: () => void;
  onError?: (error: string) => void;
}

const MajorityJudgmentBallotFormView: React.FC<MajorityJudgmentBallotFormViewProps> = ({
  voteId,
  voteTitle,
  options,
  userJudgments,
  onBallotSubmitted,
  onJudgmentChanged,
  onJudgmentsWithdrawn,
  onError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 7-level mentions best-to-worst
  const mentionKeys = ['Excellent','VeryGood','Good','Fair','Passable','Inadequate','Bad'] as const;
  const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();

  const handleJudgmentChange = async (optionId: string, mention: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const isFirstJudgment = Object.keys(userJudgments).length === 0;

      const mentionValue = (Mention as any)[mention] as any;
      spacetimeDB.reducers.submitJudgmentBallot(Number(optionId), mentionValue);

      if (isFirstJudgment) {
        for (const option of options) {
          if (option.id === optionId) {
            if (onJudgmentChanged) onJudgmentChanged(option.id, mention);
          } else {
            if (onJudgmentChanged) onJudgmentChanged(option.id, 'Bad');
          }
        }
      } else {
        if (onJudgmentChanged) onJudgmentChanged(optionId, mention);
      }

      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Failed to submit judgment:', error);
      if (onError) onError('Failed to submit judgment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawBallot = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      spacetimeDB.reducers.withdrawJudgmentBallot(Number(voteId));
      if (onJudgmentsWithdrawn) onJudgmentsWithdrawn();
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Failed to withdraw ballot:', error);
      if (onError) onError('Failed to withdraw your ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSubmittedBallot = Object.keys(userJudgments).length > 0;

  return (
    <div id={`mj-ballot-form-${voteId}`} className="ballot-interface">
      <div id={`mj-ballot-form-header-${voteId}`} className="ballot-header">
        <div id={`mj-ballot-form-label-${voteId}`} className="ballot-label">Your ballot for {voteTitle}</div>
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

      <div className="mj-ballot-form">
        {options.map((option) => {
          const userJudgment = userJudgments[String(option.id)] || 'Bad';
          return (
            <div key={option.id} className="mj-form-row">
              <div className="mj-form-option-label">{option.label}</div>
              <select
                value={userJudgment}
                onChange={(e) => handleJudgmentChange(option.id, e.target.value)}
                disabled={isSubmitting}
                className="mj-form-dropdown"
              >
                {mentionKeys.map((m) => (
                  <option key={m} value={m}>
                    {mentionLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MajorityJudgmentBallotFormView;
