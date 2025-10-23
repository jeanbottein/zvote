import React, { useEffect, useState } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';
import { Mention } from '../../../generated/mention_type';
import { JudgmentEntry } from '../../../generated/judgment_entry_type';
import { usePreferences } from '../../../context/PreferencesContext';

interface MajorityJudgmentBallotInterfaceProps {
  voteId: string;
  voteTitle: string;
  options: Array<{ id: string; label: string }>;
  userJudgments: Record<string, string>;
  onBallotSubmitted?: () => void;
  onJudgmentChanged?: (optionId: string, mention: string) => void;
  onJudgmentsWithdrawn?: () => void;
  onError?: (error: string) => void;
}

const MajorityJudgmentBallotInterface: React.FC<MajorityJudgmentBallotInterfaceProps> = ({
  voteId,
  voteTitle,
  options,
  userJudgments,
  onBallotSubmitted,
  onJudgmentChanged,
  onJudgmentsWithdrawn,
  onError
}) => {
  const { preferences } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const isEnvelopeMode = preferences.ballotSubmissionMode === 'envelope';

  // Clear pending changes when external userJudgments change (e.g., from server or withdraw)
  useEffect(() => {
    setPendingChanges({});
    setHasChanges(false);
  }, [userJudgments]);

  // 7-level mentions best-to-worst (for UI header left-to-right)
  const mentionKeys = ['Excellent','VeryGood','Good','Fair','Passable','Inadequate','Bad'] as const;
  const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();

  const handleJudgmentSubmit = async (optionId: string, mention: string) => {
    if (isEnvelopeMode) {
      // Envelope mode: only record locally
      setPendingChanges(prev => ({ ...prev, [optionId]: mention }));
      setHasChanges(true);
      return;
    }

    // Live mode: submit immediately
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
      console.error('Error submitting judgment:', error);
      if (onError) onError('Failed to submit judgment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnvelopeSubmit = async () => {
    if (isSubmitting || !hasChanges) return;
    setIsSubmitting(true);
    try {
      // Build complete ballot from pending changes overlaid onto existing judgments (default Bad)
      const completeBallot: JudgmentEntry[] = options.map(option => {
        const mention = pendingChanges[option.id] || userJudgments[option.id] || 'Bad';
        const mentionValue = (Mention as any)[mention] as any;
        return { optionId: Number(option.id), mention: mentionValue };
      });

      spacetimeDB.reducers.submitCompleteJudgmentBallot(Number(voteId), completeBallot);

      // Notify parent for all options
      for (const option of options) {
        const mention = pendingChanges[option.id] || userJudgments[option.id] || 'Bad';
        if (onJudgmentChanged) onJudgmentChanged(option.id, mention);
      }
      if (onBallotSubmitted) onBallotSubmitted();

      setPendingChanges({});
      setHasChanges(false);
    } catch (error) {
      console.error('Error submitting envelope ballot:', error);
      if (onError) onError('Failed to submit your ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawBallot = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      spacetimeDB.reducers.withdrawJudgments(Number(voteId));
      
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

  // Check if all options have been filled in envelope mode
  const allOptionsFilled = options.every(option => {
    const value = pendingChanges[option.id] || userJudgments[option.id];
    return value && value !== '';
  });

  return (
    <div id={`mj-ballot-${voteId}`} className="ballot-interface">
      <div id={`mj-ballot-header-${voteId}`} className="ballot-header">
        <div id={`mj-ballot-label-${voteId}`} className="ballot-label">Your ballot for {voteTitle}</div>
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
            const currentJudgment = (isEnvelopeMode && pendingChanges[option.id])
              ? pendingChanges[option.id]
              : userJudgments[String(option.id)];
            return (
              <tr key={option.id}>
                <td className="mj-option-title">{option.label}</td>
                {mentionKeys.map((m) => {
                  const selected = currentJudgment === (m as string);
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

      {isEnvelopeMode && (
        <button
          onClick={handleEnvelopeSubmit}
          disabled={isSubmitting || !allOptionsFilled}
          className="btn-submit-ballot"
          title={allOptionsFilled ? 'Submit your ballot' : 'All options must be filled'}
        >
          {isSubmitting ? 'Submitting...' : allOptionsFilled ? 'Submit Your Ballot' : 'Fill All Options'}
        </button>
      )}
    </div>
  );
};

export default MajorityJudgmentBallotInterface;
