import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_JUDGMENTS, option } from '../../../test/fixtures';
import MajorityJudgmentResults from './MajorityJudgmentResults';

/**
 * The ranking itself is the server's, and checked there (RankingTest): these
 * two really do tie, on Good with a GMJ score of 1/2 each. Here it arrives as
 * data, and what is tested is that the results show it.
 */
describe('the majority judgment results', () => {
  it('show the options in the order the server ranked them, ex aequo where they tie', () => {
    const { container } = render(<MajorityJudgmentResults options={[
      option({ id: '3', label: 'Pizza', judgmentCounts: { ...NO_JUDGMENTS, Good: 10, Bad: 10 },
        rank: 3, majorityMention: 'Bad', score: { numerator: 10, denominator: 10 } }),
      option({ id: '1', label: 'Ramen', judgmentCounts: { ...NO_JUDGMENTS, Excellent: 9, Good: 4, Bad: 7 },
        rank: 1, majorityMention: 'Good', score: { numerator: 2, denominator: 4 } }),
      option({ id: '2', label: 'Tacos', judgmentCounts: { ...NO_JUDGMENTS, Excellent: 8, Good: 8, Bad: 4 },
        rank: 1, majorityMention: 'Good', score: { numerator: 4, denominator: 8 } }),
    ]} />);

    expect([...container.querySelectorAll('.mj-results-title')].map((label) => label.textContent))
      .toEqual(['Ramen', 'Tacos', 'Pizza']);
    expect([...container.querySelectorAll('.mj-rank-badge')].map((badge) => badge.textContent))
      .toEqual(['1', '1', '3']);
    expect(screen.getAllByText('ex aequo')).toHaveLength(2);
  });
});
