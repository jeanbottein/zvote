import { Link } from 'react-router';
import type { PollSummary } from '../api/types';
import { timeAgo, VOTING_SYSTEM_NAMES } from './format';

interface PollListProps {
  polls: PollSummary[];
  empty: string;
}

export default function PollList({ polls, empty }: PollListProps) {
  if (polls.length === 0) {
    return <p className="empty">{empty}</p>;
  }
  return (
    <ul className="poll-list">
      {polls.map((poll) => (
        <li key={poll.id}>
          <Link className="poll-list-item" to={`/p/${poll.id}`}>
            <span className="poll-list-title">{poll.title}</span>
            <span className="poll-list-meta">
              <span>{VOTING_SYSTEM_NAMES[poll.votingSystem]}</span>
              <span>{timeAgo(poll.createdAt)}</span>
              {poll.visibility === 'PUBLIC' && <span className="badge">Public</span>}
              {poll.closedAt && <span className="badge">Closed</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
