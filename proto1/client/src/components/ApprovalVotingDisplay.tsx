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
  
  return (
    <div style={{ 
      padding: compact ? '8px' : '12px', 
      border: '1px solid var(--border)', 
      borderRadius: '8px',
      marginBottom: compact ? '4px' : '8px',
      backgroundColor: isApproved ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
      borderColor: isApproved ? '#22c55e' : 'var(--border)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: compact ? '4px' : '8px'
      }}>
        <div style={{ 
          fontWeight: '500',
          color: isApproved ? '#16a34a' : 'var(--fg)'
        }}>
          {isApproved && '✓ '}{optionLabel}
        </div>
        <div style={{ 
          fontSize: '14px',
          fontWeight: '600',
          color: approvalsCount > 0 ? '#16a34a' : 'var(--muted)'
        }}>
          {approvalsCount} approval{approvalsCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Progress bar showing approval percentage */}
      {totalVoters && totalVoters > 0 && (
        <>
          <div style={{ 
            width: '100%',
            height: compact ? '6px' : '8px',
            backgroundColor: 'var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '4px'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: approvalsCount > 0 ? '#22c55e' : 'transparent',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          {!compact && (
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--muted)',
              textAlign: 'right'
            }}>
              {percentage.toFixed(1)}% approval rate
            </div>
          )}
        </>
      )}

      {/* Live update indicator */}
      {isApproved && (
        <div style={{
          fontSize: '10px',
          color: '#16a34a',
          fontWeight: '500',
          marginTop: '4px'
        }}>
          You approved this option
        </div>
      )}
    </div>
  );
};

export default ApprovalVotingDisplay;
