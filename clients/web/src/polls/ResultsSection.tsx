import { useId } from 'react';
import type { Poll } from '../api/types';
import ApprovalResults from '../features/VotingSystem/Approval/ApprovalResults';
import MajorityJudgmentResults from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentResults';
import { downloadResults } from './exportResults';
import { ballotCount } from './format';
import type { Connection } from './usePoll';

interface ResultsSectionProps {
  poll: Poll;
  connection: Connection;
}

export default function ResultsSection({ poll, connection }: ResultsSectionProps) {
  const titleId = useId();

  return (
    <section className="panel results" aria-labelledby={titleId}>
      <div className="section-header">
        <h2 id={titleId}>Results</h2>
        <span className="results-count">{ballotCount(poll.totalBallots)}</span>
        <LiveStatus connection={connection} closed={poll.closedAt !== null} />
      </div>
      {poll.totalBallots === 0 && <p className="hint">No ballots yet. The results fill in as they arrive.</p>}
      {poll.votingSystem === 'MAJORITY_JUDGMENT'
        ? <MajorityJudgmentResults options={poll.options} />
        : <ApprovalResults options={poll.options} totalBallots={poll.totalBallots} />}
      {poll.totalBallots > 0 && (
        <div className="results-footer">
          <button type="button" className="button link" onClick={() => downloadResults(poll)}>
            Download the results
          </button>
        </div>
      )}
    </section>
  );
}

function LiveStatus({ connection, closed }: { connection: Connection; closed: boolean }) {
  if (closed) {
    return <span className="live-status" data-state="closed">Final</span>;
  }
  const label = { connecting: 'Connecting…', live: 'Live', offline: 'Reconnecting…' }[connection];
  return <span className="live-status" data-state={connection} role="status">{label}</span>;
}
