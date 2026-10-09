import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JudgmentCounts } from '../../../api/types';
import MajorityJudgmentResultsGraph from './MajorityJudgmentResultsGraph';

const none: JudgmentCounts = { Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0 };
const ramen: JudgmentCounts = { ...none, Excellent: 1, Good: 2, Bad: 1 };

function renderGraph(counts: JudgmentCounts = ramen, rank?: number) {
  const total = Object.values(counts).reduce((sum: number, count: number) => sum + count, 0);
  const { container } = render(
    <MajorityJudgmentResultsGraph
      optionLabel="Ramen"
      judgmentCounts={counts}
      totalBallots={total}
      majorityMention="Good"
      score={{ numerator: 0, denominator: 2 }}
      rank={rank}
    />,
  );
  const slices = [...container.querySelectorAll<HTMLElement>('.mj-results-bar')];
  const tooltip = () => container.querySelector('.mj-results-tooltip');
  return { container, slices, tooltip };
}

describe('the results graph', () => {
  it('draws each mention given as a slice, best first, as wide as its share', () => {
    const { slices } = renderGraph();

    expect(slices.map((slice) => [slice.dataset.judgment, slice.style.width])).toEqual([
      ['Excellent', '25%'], ['Good', '50%'], ['Bad', '25%'],
    ]);
  });

  it('describes the profile to screen readers', () => {
    renderGraph();

    expect(screen.getByRole('img')).toHaveAccessibleName('Ramen: Excellent 25%, Good 50%, Bad 25%');
  });

  it('shows the majority mention and the GMJ score', () => {
    const { container } = renderGraph();

    expect(container.querySelector('.mj-results-badge')).toHaveTextContent('Good');
    expect(container.querySelector('.mj-score-badge')).toHaveTextContent('0.00');
  });

  it('says how many gave a mention or better when it is pointed at, and dims the worse ones', () => {
    const { slices, tooltip } = renderGraph();

    fireEvent.pointerEnter(slices[1], { pointerType: 'mouse' });

    expect(tooltip()).toHaveTextContent('Good: 50%');
    expect(tooltip()).toHaveTextContent('75% say Good or better');
    expect(slices.map((slice) => slice.dataset.dimmed)).toEqual(['false', 'false', 'true']);

    fireEvent.pointerLeave(slices[1].closest('.mj-results-chart')!, { pointerType: 'mouse' });

    expect(tooltip()).toBeNull();
    expect(slices.map((slice) => slice.dataset.dimmed)).toEqual(['false', 'false', 'false']);
  });

  it('does not say "or better" of the best mention given', () => {
    const { slices, tooltip } = renderGraph();

    fireEvent.pointerEnter(slices[0], { pointerType: 'mouse' });

    expect(tooltip()).toHaveTextContent('Excellent: 25%');
    expect(tooltip()).not.toHaveTextContent('or better');
  });

  it('shows and hides the same details with a tap on touch screens', () => {
    const { slices, tooltip } = renderGraph();

    fireEvent.pointerDown(slices[2], { pointerType: 'touch' });
    expect(tooltip()).toHaveTextContent('100% say Bad or better');

    fireEvent.pointerDown(slices[2], { pointerType: 'touch' });
    expect(tooltip()).toBeNull();
  });

  it('hides tapped details with a tap anywhere else', () => {
    const { slices, tooltip } = renderGraph();

    fireEvent.pointerDown(slices[1], { pointerType: 'touch' });
    expect(tooltip()).not.toBeNull();

    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(tooltip()).toBeNull();
  });

  it('gives the top three a medal', () => {
    const { container } = renderGraph(ramen, 2);

    expect(container.querySelector('.mj-rank-badge')).toHaveAttribute('data-medal', 'silver');
  });

  it('has no slices, rank or badges before the first ballot', () => {
    const { container, slices } = renderGraph(none, 1);

    expect(slices).toHaveLength(0);
    expect(container.querySelector('.mj-rank-badge')).toBeNull();
    expect(container.querySelector('.mj-results-badges')).toBeNull();
    expect(screen.getByRole('img')).toHaveAccessibleName('Ramen: no ballots yet');
  });
});
