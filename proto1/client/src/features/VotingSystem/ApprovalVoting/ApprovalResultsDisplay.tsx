import React from 'react';

interface ApprovalResultsDisplayProps {
  optionLabel: string;
  approvalsCount: number;
  totalBallots?: number;
  compact?: boolean;
  userApproved?: boolean;
}

const ApprovalResultsDisplay: React.FC<ApprovalResultsDisplayProps> = ({ 
  optionLabel, 
  approvalsCount,
  totalBallots,
  compact = false,
  userApproved = false
}) => {
  const percentage = totalBallots && totalBallots > 0 ? (approvalsCount / totalBallots) * 100 : 0;
  const slug = optionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div
      id={`approval-results-${slug}`}
      className="approval-results-card"
      data-user-approved={userApproved ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
    >
      <div id={`approval-results-header-${slug}`} className="approval-results-header">
        <div id={`approval-results-title-${slug}`} className="approval-results-title" data-user-approved={userApproved ? 'true' : 'false'}>
          {userApproved && '✓ '}{optionLabel}
        </div>
        <div
          id={`approval-results-count-${slug}`}
          className="approval-results-count"
          data-has={approvalsCount > 0 ? 'true' : 'false'}
        >
          {approvalsCount} approval{approvalsCount !== 1 ? 's' : ''}
        </div>
      </div>

      {totalBallots && totalBallots > 0 && (
        <>
          <div id={`approval-results-progress-${slug}`} className="approval-results-progress">
            <div
              id={`approval-results-progress-bar-${slug}`}
              className="approval-results-progress-bar"
              style={{ ['--pct' as any]: `${percentage}%` }}
            />
          </div>
          {!compact && (
            <div id={`approval-results-rate-${slug}`} className="approval-results-count" style={{ textAlign: 'right', fontSize: '11px' }}>
              {percentage.toFixed(1)}% approval rate
            </div>
          )}
        </>
      )}

      {userApproved && (
        <div id={`approval-results-note-${slug}`} className="approval-results-note">
          You approved this option
        </div>
      )}
    </div>
  );
};

export default ApprovalResultsDisplay;
