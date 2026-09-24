import { describe, expect, it } from 'vitest';
import { rankByApprovals } from './approvalRanking';

const option = (id: string, approvalCount: number | null) => ({ id, label: `Option ${id}`, approvalCount });

describe('rankByApprovals', () => {
  it('puts the most approved option first', () => {
    const ranked = rankByApprovals([option('a', 1), option('b', 5), option('c', 3)]);

    expect(ranked.map((o) => [o.id, o.rank])).toEqual([['b', 1], ['c', 2], ['a', 3]]);
  });

  it('gives tied options the same rank and skips the places they take', () => {
    const ranked = rankByApprovals([option('a', 2), option('b', 4), option('c', 4), option('d', 1)]);

    expect(ranked.map((o) => [o.id, o.rank])).toEqual([['b', 1], ['c', 1], ['a', 3], ['d', 4]]);
  });

  it('treats missing counts as no approvals', () => {
    const ranked = rankByApprovals([option('a', null), option('b', 0)]);

    expect(ranked.map((o) => [o.id, o.approvals, o.rank])).toEqual([['a', 0, 1], ['b', 0, 1]]);
  });
});
