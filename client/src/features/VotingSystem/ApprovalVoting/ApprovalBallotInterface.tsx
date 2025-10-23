import React, { useEffect, useState } from 'react';
import { spacetimeDB } from '../../../lib/spacetimeClient';
import { usePreferences } from '../../../context/PreferencesContext';

interface ApprovalBallotInterfaceProps {
  voteId: string;
  voteTitle: string;
  options: Array<{ id: string; label: string }>;
  userApprovals: Set<string>;
  onBallotSubmitted?: () => void;
  onApprovalChanged?: (optionId: string, approved: boolean) => void;
  onApprovalsWithdrawn?: () => void;
  onError?: (error: string) => void;
}

const ApprovalBallotInterface: React.FC<ApprovalBallotInterfaceProps> = ({
  voteId,
  voteTitle,
  options,
  userApprovals,
  onBallotSubmitted,
  onApprovalChanged,
  onApprovalsWithdrawn,
  onError
}) => {
  const { preferences } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const isEnvelopeMode = preferences.ballotSubmissionMode === 'envelope';

  // Clear pending changes when external userApprovals change (e.g., from server or withdraw)
  useEffect(() => {
    setPendingApprovals(new Set());
    setHasChanges(false);
  }, [userApprovals]);

  const handleApprovalToggle = async (optionId: string, approve: boolean) => {
    if (isEnvelopeMode) {
      // Envelope mode: only record locally
      setPendingApprovals(prev => {
        const updated = new Set(prev);
        if (approve) {
          updated.add(optionId);
        } else {
          updated.delete(optionId);
        }
        return updated;
      });
      setHasChanges(true);
      return;
    }

    // Live mode: submit immediately
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (approve) {
        spacetimeDB.reducers.submitApprovalBallot(Number(voteId), Number(optionId));
      } else {
        spacetimeDB.reducers.withdrawApprovalBallot(Number(voteId), Number(optionId));
      }
      
      // Notify parent that approval changed
      if (onApprovalChanged) onApprovalChanged(optionId, approve);
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error submitting ballot:', error);
      if (onError) onError('Failed to submit ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnvelopeSubmit = async () => {
    if (isSubmitting || !hasChanges) return;
    setIsSubmitting(true);
    try {
      // Build complete approval ballot from pending changes overlaid onto existing approvals
      const completeApprovals = new Set(userApprovals);
      
      // Apply pending changes
      for (const optionId of pendingApprovals) {
        if (!userApprovals.has(optionId)) {
          completeApprovals.add(optionId);
        }
      }
      
      // Remove any that were toggled off
      for (const optionId of userApprovals) {
        if (pendingApprovals.has(optionId) && userApprovals.has(optionId)) {
          completeApprovals.delete(optionId);
        }
      }

      // Submit complete ballot
      spacetimeDB.reducers.setApprovalBallot(Number(voteId), Array.from(completeApprovals).map(id => Number(id)));

      // Notify parent for all changes
      for (const optionId of completeApprovals) {
        if (onApprovalChanged) onApprovalChanged(optionId, true);
      }
      for (const optionId of userApprovals) {
        if (!completeApprovals.has(optionId) && onApprovalChanged) {
          onApprovalChanged(optionId, false);
        }
      }
      if (onBallotSubmitted) onBallotSubmitted();

      setPendingApprovals(new Set());
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
      // Remove all user's approvals for this vote
      for (const optionId of userApprovals) {
        spacetimeDB.reducers.withdrawApprovalBallot(Number(voteId), Number(optionId));
      }
      
      // Notify parent that all approvals were withdrawn
      if (onApprovalsWithdrawn) onApprovalsWithdrawn();
      if (onBallotSubmitted) onBallotSubmitted();
    } catch (error) {
      console.error('Error withdrawing ballot:', error);
      if (onError) onError('Failed to withdraw your ballot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // In envelope mode, show pending changes; in live mode, show actual approvals
  const currentApprovals = isEnvelopeMode 
    ? new Set([...userApprovals, ...pendingApprovals])
    : userApprovals;
  
  const approvedOptions = options.filter(opt => currentApprovals.has(opt.id));
  const unapprovedOptions = options.filter(opt => !currentApprovals.has(opt.id));
  const hasSubmittedBallot = userApprovals.size > 0;

  return (
    <div id={`approval-ballot-${voteId}`} className="ballot-interface">
      <div id={`approval-ballot-header-${voteId}`} className="ballot-header">
        <div id={`approval-ballot-label-${voteId}`} className="ballot-label">Your ballot for {voteTitle}</div>
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

      {/* Envelope mode submit button */}
      {isEnvelopeMode && (
        <button
          onClick={handleEnvelopeSubmit}
          disabled={isSubmitting || !hasChanges}
          className="btn-submit-ballot"
          title={hasChanges ? "Submit your ballot" : "No changes to submit"}
        >
          {isSubmitting ? 'Submitting...' : hasChanges ? 'Submit Your Ballot' : 'No Changes'}
        </button>
      )}
    </div>
  );
};

export default ApprovalBallotInterface;
