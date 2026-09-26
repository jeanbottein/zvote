import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PollOption } from '../../../api/types';
import MajorityJudgmentResults from './MajorityJudgmentResults';

const none = { Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0 };
const option = (id: string, label: string, judgmentCounts: typeof none): PollOption =>
  ({ id, label, approvalCount: null, judgmentCounts });

describe('the majority judgment results', () => {
  it('show options tied on majority mention and GMJ score as ex aequo, with the same rank', () => {
    const { container } = render(<MajorityJudgmentResults options={[
      option('1', 'Ramen', { ...none, Excellent: 9, Good: 4, Bad: 7 }),
      option('2', 'Tacos', { ...none, Excellent: 8, Good: 8, Bad: 4 }),
      option('3', 'Pizza', { ...none, Good: 10, Bad: 10 }),
    ]} />);

    const ranks = [...container.querySelectorAll('.mj-rank-badge')].map((badge) => badge.textContent);
    expect(ranks).toEqual(['1', '1', '3']);
    expect(screen.getAllByText('ex aequo')).toHaveLength(2);
  });
});
