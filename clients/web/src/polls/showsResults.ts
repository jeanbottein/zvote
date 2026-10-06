import type { Poll } from '../api/types';

/**
 * Whether the poll's tallies are shown now, by the same rule as the server
 * (which sends none until then). Once closed, they always are.
 */
export function showsResults(poll: Pick<Poll, 'closedAt' | 'resultsShown' | 'resultsAfterBallots' | 'totalBallots'>) {
  if (poll.closedAt !== null) {
    return true;
  }
  switch (poll.resultsShown) {
    case 'LIVE':
      return true;
    case 'AFTER_BALLOTS':
      return poll.totalBallots >= (poll.resultsAfterBallots ?? Infinity);
    case 'AFTER_CLOSING':
      return false;
  }
}
