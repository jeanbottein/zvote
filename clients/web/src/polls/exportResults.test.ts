import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Poll } from '../api/types';
import { downloadResults, resultsDocument } from './exportResults';

const none = { Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0 };

const lunch: Poll = {
  id: 'abc',
  title: 'Where do we eat?',
  votingSystem: 'MAJORITY_JUDGMENT',
  visibility: 'PUBLIC',
  createdAt: '2026-09-24T10:00:00Z',
  closedAt: '2026-09-24T12:00:00Z',
  isMine: true,
  totalBallots: 3,
  options: [
    { id: '1', label: 'Ramen', approvalCount: null, judgmentCounts: { ...none, Fair: 2, Bad: 1 } },
    { id: '2', label: 'Tacos', approvalCount: null, judgmentCounts: { ...none, Excellent: 2, Good: 1 } },
  ],
  myBallot: null,
};

describe('the results document', () => {
  it('ranks majority judgment options with their majority mention and GMJ score', () => {
    const document = resultsDocument(lunch, new Date('2026-09-24T13:00:00Z'));

    expect(document).toEqual({
      poll: {
        id: 'abc',
        title: 'Where do we eat?',
        votingSystem: 'MAJORITY_JUDGMENT',
        createdAt: '2026-09-24T10:00:00Z',
        closedAt: '2026-09-24T12:00:00Z',
      },
      exportedAt: '2026-09-24T13:00:00.000Z',
      totalBallots: 3,
      ranking: [
        { rank: 1, label: 'Tacos', majorityMention: 'Excellent', gmjScore: -0.5, judgmentCounts: lunch.options[1].judgmentCounts },
        { rank: 2, label: 'Ramen', majorityMention: 'Fair', gmjScore: -0.5, judgmentCounts: lunch.options[0].judgmentCounts },
      ],
    });
  });

  it('ranks approval options by their approvals', () => {
    const document = resultsDocument({
      ...lunch,
      votingSystem: 'APPROVAL',
      options: [
        { id: '1', label: 'Ramen', approvalCount: 1, judgmentCounts: null },
        { id: '2', label: 'Tacos', approvalCount: 3, judgmentCounts: null },
      ],
    });

    expect(document.ranking).toEqual([
      { rank: 1, label: 'Tacos', approvals: 3 },
      { rank: 2, label: 'Ramen', approvals: 1 },
    ]);
  });
});

describe('downloading the results', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('saves them as a JSON file named after the poll, then lets the file go', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn((blob: Blob) => (blob.type === 'application/json' ? 'blob:results' : 'blob:other'));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:results');
      expect(this.download).toBe('zvote-results-abc.json');
    });

    downloadResults(lunch);

    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled(); // the browser may still be reading it
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:results');
  });
});
