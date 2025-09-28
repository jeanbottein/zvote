import React from 'react';

interface ApprovalVotingDisplayProps {
  optionLabel: string;
  approvalsCount: number;
  totalVoters?: number;
  compact?: boolean;
  isApproved?: boolean;
}

const ApprovalVotingDisplay: React.FC<ApprovalVotingDisplayProps> = ({ 
  optionLabel, 
  approvalsCount,
  totalVoters,
  compact = false,
  isApproved = false
}) => {
  const percentage = totalVoters && totalVoters > 0 ? (approvalsCount / totalVoters) * 100 : 0;
  const slug = optionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div
      id={`approval-card-${slug}`}
      className="approval-card"
      data-approved={isApproved ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
    >
      <div id={`approval-header-${slug}`} className="approval-header">
        <div id={`approval-title-${slug}`} className="approval-title" data-approved={isApproved ? 'true' : 'false'}>
          {isApproved && '✓ '}{optionLabel}
        </div>
        <div
          id={`approval-count-${slug}`}
          className="approval-count"
          data-has={approvalsCount > 0 ? 'true' : 'false'}
        >
          {approvalsCount} approval{approvalsCount !== 1 ? 's' : ''}
        </div>
      </div>

      {totalVoters && totalVoters > 0 && (
        <>
          <div id={`approval-progress-${slug}`} className="approval-progress">
            <div
              id={`approval-progress-bar-${slug}`}
              className="approval-progress-bar"
              style={{ ['--pct' as any]: `${percentage}%` }}
            />
          </div>
          {!compact && (
            <div id={`approval-rate-${slug}`} className="approval-count" style={{ textAlign: 'right', fontSize: '11px' }}>
              {percentage.toFixed(1)}% approval rate
            </div>
          )}
        </>
      )}

      {isApproved && (
        <div id={`approval-note-${slug}`} className="approval-note">
          You approved this option
        </div>
      )}
    </div>
  );
};

export default ApprovalVotingDisplay;
