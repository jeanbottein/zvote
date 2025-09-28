import type { TieBreakStrategy, JudgmentCounts, MJComparison, StrategyDeps } from './types';

const jeanbotteinStrategy: TieBreakStrategy = {
  key: 'jeanbottein',
  label: 'MJ: Iterative truncation (Jeanbottein)',
  description:
    'Lexicographic comparison of majority iterations; at each step remove all ballots at or above the current majority mention.',
  compare: (countsA: JudgmentCounts, countsB: JudgmentCounts, deps: StrategyDeps): MJComparison => {
    const analysisA = deps.computeMJAnalysis(countsA);
    const analysisB = deps.computeMJAnalysis(countsB);

    const maxIterations = Math.max(analysisA.iterations.length, analysisB.iterations.length);
    const iterations: MJComparison['iterations'] = [];

    for (let i = 0; i < maxIterations; i++) {
      const iterA = analysisA.iterations[i];
      const iterB = analysisB.iterations[i];

      if (iterA && iterB) {
        const mentionComparison = deps.compareMentions(iterA.mention, iterB.mention);
        if (mentionComparison !== 0) {
          iterations.push({
            mention: iterA.mention,
            percentageA: iterA.percentage,
            percentageB: iterB.percentage,
            strengthA: iterA.strengthPercent,
            strengthB: iterB.strengthPercent,
            result: mentionComparison > 0 ? 'A_WINS' : 'B_WINS',
          });
          return {
            winner: mentionComparison > 0 ? 'A' : 'B',
            iterations,
            finalResult: `${mentionComparison > 0 ? 'A' : 'B'} wins on ${iterA.mention} vs ${iterB.mention}`,
          };
        }

        if (iterA.strengthPercent !== iterB.strengthPercent) {
          const strengthWinner = iterA.strengthPercent > iterB.strengthPercent ? 'A_WINS' : 'B_WINS';
          iterations.push({
            mention: iterA.mention,
            percentageA: iterA.percentage,
            percentageB: iterB.percentage,
            strengthA: iterA.strengthPercent,
            strengthB: iterB.strengthPercent,
            result: strengthWinner,
          });
          return {
            winner: strengthWinner === 'A_WINS' ? 'A' : 'B',
            iterations,
            finalResult: `${strengthWinner === 'A_WINS' ? 'A' : 'B'} wins on strength: ${iterA.strengthPercent.toFixed(
              1
            )}% vs ${iterB.strengthPercent.toFixed(1)}%`,
          };
        }

        iterations.push({
          mention: iterA.mention,
          percentageA: iterA.percentage,
          percentageB: iterB.percentage,
          strengthA: iterA.strengthPercent,
          strengthB: iterB.strengthPercent,
          result: 'TIE',
        });
      }
    }

    return { winner: 'TIE', iterations, finalResult: 'Perfect tie - ex aequo' };
  },
};

export default jeanbotteinStrategy;
