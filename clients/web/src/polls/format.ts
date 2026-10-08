import type { Visibility, VotingSystem } from '../api/types';
import { formatCount } from '../utils/formatCount';

export const VOTING_SYSTEM_NAMES: Record<VotingSystem, string> = {
  MAJORITY_JUDGMENT: 'Majority judgment',
  APPROVAL: 'Approval voting',
};

export const VISIBILITY_NAMES: Record<Visibility, string> = {
  PUBLIC: 'Public',
  UNLISTED: 'Private',
};

/** A join code as people read it: K7M-4QX. */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** "and 2 anonymous voters", or "1 anonymous voter" when nobody gave a name. */
export function anonymousVoters(count: number, afterNames: boolean): string {
  const voters = `${formatCount(count)} anonymous ${count === 1 ? 'voter' : 'voters'}`;
  return afterNames ? `and ${voters}` : voters;
}

/** "and 1,234 more voters": past the names shown, named or not. */
export function moreVoters(count: number): string {
  return `and ${formatCount(count)} more ${count === 1 ? 'voter' : 'voters'}`;
}

const longDate = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

/** "October 30, 2026". */
export function formatDate(isoDate: string): string {
  return longDate.format(new Date(isoDate));
}

export function ballotCount(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'ballot' : 'ballots'}`;
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday", "just now". */
export function timeAgo(isoDate: string, now = Date.now()): string {
  const seconds = (new Date(isoDate).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeTime.format(Math.round(seconds / size), unit);
    }
  }
  return 'just now';
}
