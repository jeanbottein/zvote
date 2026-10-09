import type { PollOption } from '../../../api/types';
import { formatCount } from '../../../utils/formatCount';
import { ranked } from '../ranked';
import './approval.css';

interface ApprovalResultsProps {
  options: PollOption[];
  totalBallots: number;
}

/** The options, most approved first, each with the share of voters who approved it. */
export default function ApprovalResults({ options, totalBallots }: ApprovalResultsProps) {
  const counted = totalBallots > 0;

  return (
    <ol className="approval-results">
      {ranked(options).map(({ option, rank }) => {
        const approvals = option.approvalCount ?? 0;
        const share = counted ? approvals / totalBallots : 0;
        return (
          <li key={option.id} className="approval-result" data-winner={counted && rank === 1}>
            <div className="approval-result-head">
              {counted && <span className="approval-rank" aria-label={`Rank ${rank}`}>{rank}</span>}
              <span className="approval-result-label">{option.label}</span>
              <span className="approval-result-count">
                {formatCount(approvals)} {approvals === 1 ? 'approval' : 'approvals'}
                {counted && ` · ${Math.round(share * 100)}%`}
              </span>
            </div>
            <div className="approval-bar" aria-hidden="true">
              <div className="approval-bar-fill" style={{ width: `${share * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
