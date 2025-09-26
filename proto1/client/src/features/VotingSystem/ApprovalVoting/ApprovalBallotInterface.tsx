import React, { useState } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';

interface ApprovalBallotInterfaceProps {
  voteId: string;
  options: Array<{ id: string; label: string }>;
  userApprovals: Set<string>;
  onBallotSubmitted?: () => void;
  onError?: (error: string) => void;
}

const ApprovalBallotInterface: React.FC<ApprovalBallotInterfaceProps> = ({
  voteId,
  options,
  userApprovals,
  onBallotSubmitted,
  onError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprovalToggle = async (optionId: string, approve: boolean) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (approve) {
        await spacetimeDB.call('submit_approval_ballot', voteId, optionId);
      } else {
        await spacetimeDB.call('withdraw_approval_ballot', voteId, optionId);
      }
      
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error submitting ballot:', error);
      if (onError) onError('Failed to submit ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawBallot = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Remove all user's approvals for this vote
      for (const optionId of userApprovals) {
        await spacetimeDB.call('withdraw_approval_ballot', voteId, optionId);
      }
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error withdrawing ballot:', error);
      if (onError) onError('Failed to withdraw your ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvedOptions = options.filter(opt => userApprovals.has(opt.id));
  const unapprovedOptions = options.filter(opt => !userApprovals.has(opt.id));
  const hasSubmittedBallot = userApprovals.size > 0;

  return (
    <div id={`approval-ballot-${voteId}`} className="ballot-interface">
      <div id={`approval-ballot-header-${voteId}`} className="ballot-header">
        <div id={`approval-ballot-label-${voteId}`} className="ballot-label">Your ballot</div>
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

      {approvedOptions.length > 0 && (
        <div>
          <div id={`approval-ballot-approved-hint-${voteId}`} className="ballot-section-hint">Your approvals</div>
          <div id={`approval-ballot-approved-tags-${voteId}`} className="ballot-tags">
            {approvedOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleApprovalToggle(option.id, false)}
                disabled={isSubmitting}
                className="ballot-tag"
                data-state="approved"
              >
                ✓ {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div id={`approval-ballot-options-hint-${voteId}`} className="ballot-section-hint">Available options</div>
        <div id={`approval-ballot-options-tags-${voteId}`} className="ballot-tags">
          {unapprovedOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleApprovalToggle(option.id, true)}
              disabled={isSubmitting}
              className="ballot-tag"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApprovalBallotInterface;
