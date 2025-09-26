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

  const mentionOrder: Record<string, number> = {
    ToReject: 1,
    Passable: 2,
    Good: 3,
    VeryGood: 4,
    Excellent: 5,
  };

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
        // We need to notify parent about all the default ToReject judgments
        for (const option of options) {
          if (option.id === optionId) {
            // This is the option the user explicitly judged
            if (onJudgmentChanged) onJudgmentChanged(option.id, mention);
          } else {
            // These options were automatically set to ToReject by the server
            if (onJudgmentChanged) onJudgmentChanged(option.id, 'ToReject');
          }
        }
      } else {
        // Not the first judgment, just update the specific option
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

      {options.map((option) => {
        const userJudgment = userJudgments[String(option.id)];
        const sliderValue = userJudgment ? (mentionOrder[userJudgment] - 1) : -1;
        
        const mentionKeys: Array<keyof typeof mentionOrder> = ['ToReject','Passable','Good','VeryGood','Excellent'];
        const mentionLabel = (m: string) => m.replace(/([A-Z])/g, ' $1').trim();

        return (
          <div key={option.id} id={`mj-ballot-item-${option.id}`} className="ballot-item">
            <div id={`mj-ballot-item-title-${option.id}`} className="ballot-item-title">{option.label}</div>

            <div id={`mj-ballot-slider-wrap-${option.id}`} className="mj-ballot-slider-wrap">
              {/* Tick marks behind the slider */}
              {[10,30,50,70,90].map((left, idx) => (
                <div key={idx} className="mj-ballot-tick" style={{ ['--left' as any]: `${left}%` }} />
              ))}

              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={sliderValue >= 0 ? sliderValue : 2}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const mention = mentionKeys[val] as string;
                  handleJudgmentSubmit(option.id, mention);
                }}
                disabled={isSubmitting}
                className="mj-ballot-slider"
              />
              
              {/* Custom thumb - show only when user has voted */}
              {sliderValue >= 0 && (
                <div className="mj-ballot-thumb" style={{ ['--left' as any]: `${[10,30,50,70,90][sliderValue]}%` }} />
              )}

              {/* Mention labels under the slider, clickable to set value */}
              <div id={`mj-ballot-mentions-${option.id}`} className="mj-ballot-mentions">
                {mentionKeys.map((m) => {
                  const selected = userJudgment === (m as string);
                  return (
                    <button
                      key={m}
                      onClick={() => handleJudgmentSubmit(option.id, m as string)}
                      disabled={isSubmitting}
                      className="mj-ballot-mention"
                      data-selected={selected ? 'true' : 'false'}
                      data-mention={m as string}
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
  );
};

export default MajorityJudgmentBallotInterface;
