import type { TieBreakStrategy, JudgmentCounts, MJComparison, StrategyDeps } from './types';

const order: (keyof JudgmentCounts)[] = [
  'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
];

function cloneCounts(c: JudgmentCounts): JudgmentCounts {
  return {
    Bad: c.Bad,
    Inadequate: c.Inadequate,
    Passable: c.Passable,
    Fair: c.Fair,
    Good: c.Good,
    VeryGood: c.VeryGood,
    Excellent: c.Excellent,
  };
}

function total(c: JudgmentCounts): number {
  return c.Bad + c.Inadequate + c.Passable + c.Fair + c.Good + c.VeryGood + c.Excellent;
}

function atLeastPct(c: JudgmentCounts, mention: keyof JudgmentCounts): number {
  const idx = order.indexOf(mention);
  let sum = 0;
  for (let i = 0; i <= idx; i++) sum += c[order[i]];
  const t = total(c) || 1;
  return (sum / t) * 100;
}

function majorityMention(c: JudgmentCounts): keyof JudgmentCounts | null {
  for (const m of order) {
    if (atLeastPct(c, m) >= 50) return m;
  }
  return null;
}

function supportersAbove(c: JudgmentCounts, majority: keyof JudgmentCounts): number {
  const idx = order.indexOf(majority);
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += c[order[i]];
  const t = total(c) || 1;
  return (sum / t) * 100;
}

function opponentsBelow(c: JudgmentCounts, majority: keyof JudgmentCounts): number {
  const idx = order.indexOf(majority);
  let sum = 0;
  for (let i = idx + 1; i < order.length; i++) sum += c[order[i]];
  const t = total(c) || 1;
  return (sum / t) * 100;
}

const ballotRemovalStrategy: TieBreakStrategy = {
  key: 'mj-ballot-removal',
  label: 'MJ: Canonical ballot-removal',
  description:
    'Canonical MJ tie-break: if tie persists, remove one ballot at the majority grade for each tied option, then recompute. Repeats until tie breaks or ballots exhausted.',
  compare: (a0: JudgmentCounts, b0: JudgmentCounts, deps: StrategyDeps): MJComparison => {
    // Work on local copies
    let A = cloneCounts(a0);
    let B = cloneCounts(b0);

    const iterations: MJComparison['iterations'] = [];
    const maxSteps = 100; // safety

    for (let step = 0; step < maxSteps; step++) {
      const majA = majorityMention(A) || 'Bad';
      const majB = majorityMention(B) || 'Bad';

      const mentionCmp = deps.compareMentions(majA, majB);
      if (mentionCmp !== 0) {
        return {
          winner: mentionCmp > 0 ? 'A' : 'B',
          iterations,
          finalResult: `${mentionCmp > 0 ? 'A' : 'B'} wins on majority mention`,
        };
      }

      // Same majority grade, compare supporters above
      const supA = supportersAbove(A, majA);
      const supB = supportersAbove(B, majB);
      if (supA !== supB) {
        iterations.push({
          mention: majA,
          percentageA: supA,
          percentageB: supB,
          strengthA: supA,
          strengthB: supB,
          result: supA > supB ? 'A_WINS' : 'B_WINS',
        });
        return {
          winner: supA > supB ? 'A' : 'B',
          iterations,
          finalResult: `${supA > supB ? 'A' : 'B'} wins on supporters above majority (${supA.toFixed(1)}% vs ${supB.toFixed(1)}%)`,
        };
      }

      // Same supporters above, compare opponents below (lower is better)
      const oppA = opponentsBelow(A, majA);
      const oppB = opponentsBelow(B, majB);
      if (oppA !== oppB) {
        iterations.push({
          mention: majA,
          percentageA: 100 - oppA,
          percentageB: 100 - oppB,
          strengthA: -oppA,
          strengthB: -oppB,
          result: oppA < oppB ? 'A_WINS' : 'B_WINS',
        });
        return {
          winner: oppA < oppB ? 'A' : 'B',
          iterations,
          finalResult: `${oppA < oppB ? 'A' : 'B'} wins on fewer opponents below (${oppA.toFixed(1)}% vs ${oppB.toFixed(1)}%)`,
        };
      }

      // Perfect tie on this step – remove one ballot at the majority grade from both and repeat
      if (A[majA] > 0) A = { ...A, [majA]: A[majA] - 1 } as JudgmentCounts;
      if (B[majB] > 0) B = { ...B, [majB]: B[majB] - 1 } as JudgmentCounts;

      // If nothing can be removed anymore, declare tie
      if ((A[majA] === 0 && B[majB] === 0) || (total(A) === 0 && total(B) === 0)) {
        break;
      }
    }

    return { winner: 'TIE', iterations, finalResult: 'Tie after ballot-removal steps' };
  },
};

export default ballotRemovalStrategy;
