import React, { useState, useEffect } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';
import { Mention } from '../../../generated/mention_type';
import { JudgmentEntry } from '../../../generated/judgment_entry_type';
import { usePreferences } from '../../../context/PreferencesContext';

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
  const { preferences } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const isEnvelopeMode = preferences.ballotSubmissionMode === 'envelope';

  // Sync pending changes with user judgments when they change externally
  useEffect(() => {
    setPendingChanges({});
    setHasChanges(false);
  }, [userJudgments]);

  // 7-level mentions best-to-worst
  const mentionKeys = ['Excellent','VeryGood','Good','Fair','Passable','Inadequate','Bad'] as const;
  const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();

  const handleJudgmentChange = async (optionId: string, mention: string) => {
    if (isEnvelopeMode) {
      // Envelope mode: just track the change locally
      setPendingChanges(prev => ({ ...prev, [optionId]: mention }));
      setHasChanges(true);
    } else {
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
        console.error('Failed to submit judgment:', error);
        if (onError) onError('Failed to submit judgment. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEnvelopeSubmit = async () => {
    if (isSubmitting || !hasChanges) return;

    setIsSubmitting(true);
    try {
      // Build complete envelope ballot: combine user judgments with pending changes
      const completeBallot: JudgmentEntry[] = options.map(option => {
        // Use pending change if available, otherwise use existing judgment, otherwise default to Bad
        const mention = pendingChanges[option.id] || userJudgments[option.id] || 'Bad';
        const mentionValue = (Mention as any)[mention] as any;
        
        return {
          optionId: Number(option.id),
          mention: mentionValue
        };
      });

      // Validate all options have been judged
      if (completeBallot.length !== options.length) {
        throw new Error('Incomplete ballot: not all options have been judged');
      }

      // Submit complete ballot in one call
      spacetimeDB.reducers.submitCompleteJudgmentBallot(Number(voteId), completeBallot);

      // Notify parent of all judgments
      for (const option of options) {
        const mention = pendingChanges[option.id] || userJudgments[option.id] || 'Bad';
        if (onJudgmentChanged) onJudgmentChanged(option.id, mention);
      }

      if (onBallotSubmitted) onBallotSubmitted();
      
      // Clear pending changes
      setPendingChanges({});
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to submit ballot:', error);
      if (onError) onError('Failed to submit ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawBallot = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      spacetimeDB.reducers.withdrawJudgments(Number(voteId));
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

  // Check if all options have been filled in envelope mode
  const allOptionsFilled = options.every(option => {
    const value = pendingChanges[option.id] || userJudgments[option.id];
    return value && value !== '';
  });

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
          // Show pending change if in envelope mode, otherwise show user judgment
          const currentValue = isEnvelopeMode && pendingChanges[option.id] 
            ? pendingChanges[option.id]
            : userJudgments[String(option.id)] || '';
          
          return (
            <div key={option.id} className="mj-form-row">
              <div className="mj-form-option-label">{option.label}</div>
              <select
                value={currentValue}
                onChange={(e) => handleJudgmentChange(option.id, e.target.value)}
                disabled={isSubmitting}
                className="mj-form-dropdown"
              >
                <option value="" disabled>
                  Select a grade...
                </option>
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

      {/* Envelope mode submit button */}
      {isEnvelopeMode && (
        <button
          onClick={handleEnvelopeSubmit}
          disabled={isSubmitting || !allOptionsFilled}
          className="btn-submit-ballot"
          title={allOptionsFilled ? "Submit your ballot" : "All options must be filled"}
        >
          {isSubmitting ? 'Submitting...' : allOptionsFilled ? 'Submit Your Ballot' : 'Fill All Options'}
        </button>
      )}
    </div>
  );
};

export default MajorityJudgmentBallotFormView;
