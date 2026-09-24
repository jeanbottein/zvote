import type { PollOption } from '../../../api/types';
import { rankByApprovals } from './approvalRanking';
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
      {rankByApprovals(options).map((standing) => {
        const share = counted ? standing.approvals / totalBallots : 0;
        return (
          <li key={standing.id} className="approval-result" data-winner={counted && standing.rank === 1}>
            <div className="approval-result-head">
              {counted && <span className="approval-rank" aria-label={`Rank ${standing.rank}`}>{standing.rank}</span>}
              <span className="approval-result-label">{standing.label}</span>
              <span className="approval-result-count">
                {standing.approvals} {standing.approvals === 1 ? 'approval' : 'approvals'}
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
