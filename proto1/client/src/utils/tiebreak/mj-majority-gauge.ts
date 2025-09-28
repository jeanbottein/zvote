import type { TieBreakStrategy, JudgmentCounts, MJComparison, StrategyDeps } from './types';

const mentionsOrder: (keyof JudgmentCounts)[] = [
  'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
];

function total(counts: JudgmentCounts) {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

function supportersAbove(counts: JudgmentCounts, majority: keyof JudgmentCounts) {
  const idx = mentionsOrder.indexOf(majority);
  if (idx <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += counts[mentionsOrder[i]];
  return sum;
}

function opponentsBelow(counts: JudgmentCounts, majority: keyof JudgmentCounts) {
  const idx = mentionsOrder.indexOf(majority);
  if (idx < 0) return 0;
  let sum = 0;
  for (let i = idx + 1; i < mentionsOrder.length; i++) sum += counts[mentionsOrder[i]];
  return sum;
}

const majorityGaugeStrategy: TieBreakStrategy = {
  key: 'mj-majority-gauge',
  label: 'MJ: Majority gauge (supporters/opponents)',
  description: 'Canonical MJ tie-break: compare supporters strictly above the majority, then opponents strictly below (lower is better). No ballot-by-ballot removal.',
  compare: (a: JudgmentCounts, b: JudgmentCounts, deps: StrategyDeps): MJComparison => {
    const A = deps.computeMJAnalysis(a);
    const B = deps.computeMJAnalysis(b);

    const majA = A.iterations[0]?.mention || 'Bad';
    const majB = B.iterations[0]?.mention || 'Bad';

    const mentionCmp = deps.compareMentions(majA, majB);
    if (mentionCmp !== 0) {
      return {
        winner: mentionCmp > 0 ? 'A' : 'B',
        iterations: [{
          mention: majA,
          percentageA: 0,
          percentageB: 0,
          strengthA: 0,
          strengthB: 0,
          result: mentionCmp > 0 ? 'A_WINS' : 'B_WINS',
        }],
        finalResult: `${mentionCmp > 0 ? 'A' : 'B'} wins on majority mention`,
      };
    }

    const totA = total(a) || 1;
    const totB = total(b) || 1;

    const supA = (supportersAbove(a, majA) / totA) * 100;
    const supB = (supportersAbove(b, majB) / totB) * 100;

    if (supA !== supB) {
      return {
        winner: supA > supB ? 'A' : 'B',
        iterations: [{
          mention: majA,
          percentageA: supA,
          percentageB: supB,
          strengthA: supA,
          strengthB: supB,
          result: supA > supB ? 'A_WINS' : 'B_WINS',
        }],
        finalResult: `${supA > supB ? 'A' : 'B'} wins on supporters above majority (${supA.toFixed(1)}% vs ${supB.toFixed(1)}%)`,
      };
    }

    const oppA = (opponentsBelow(a, majA) / totA) * 100;
    const oppB = (opponentsBelow(b, majB) / totB) * 100;

    if (oppA !== oppB) {
      return {
        winner: oppA < oppB ? 'A' : 'B',
        iterations: [{
          mention: majA,
          percentageA: 100 - oppA,
          percentageB: 100 - oppB,
          strengthA: -oppA,
          strengthB: -oppB,
          result: oppA < oppB ? 'A_WINS' : 'B_WINS',
        }],
        finalResult: `${oppA < oppB ? 'A' : 'B'} wins on fewer opponents below (${oppA.toFixed(1)}% vs ${oppB.toFixed(1)}%)`,
      };
    }

    return { winner: 'TIE', iterations: [], finalResult: 'Perfect tie - majority gauge' };
  },
};

export default majorityGaugeStrategy;
