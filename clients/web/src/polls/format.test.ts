import { describe, expect, it } from 'vitest';
import { ballotCount, timeAgo } from './format';

describe('timeAgo', () => {
  const now = Date.parse('2026-09-24T12:00:00Z');

  it.each([
    ['2026-09-24T11:59:30Z', 'just now'],
    ['2026-09-24T11:55:00Z', '5 minutes ago'],
    ['2026-09-24T09:00:00Z', '3 hours ago'],
    ['2026-09-23T12:00:00Z', 'yesterday'],
    ['2026-09-10T12:00:00Z', '2 weeks ago'],
    ['2025-09-24T12:00:00Z', 'last year'],
  ])('reads %s as "%s"', (date, expected) => {
    expect(timeAgo(date, now)).toBe(expected);
  });
});

describe('ballotCount', () => {
  it('agrees in number', () => {
    expect(ballotCount(0)).toBe('0 ballots');
    expect(ballotCount(1)).toBe('1 ballot');
    expect(ballotCount(12)).toBe('12 ballots');
  });
});
