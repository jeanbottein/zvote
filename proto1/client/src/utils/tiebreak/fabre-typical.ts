/**
 * Adrien Fabre's Typical Judgment Tie-Breaking Method
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 * 
 * For candidates tied on the median mention, calculate:
 * - pc: proportion of voters rating strictly above the median
 * - qc: proportion of voters rating strictly below the median  
 * - rc: proportion of voters rating exactly the median
 * 
 * Typical judgment score: sT = pc - qc
 * 
 * This method compares the difference between proponents (above median)
 * and opponents (below median), providing a stable monotonic order.
 */

import type { JudgmentCounts, MJComparison, TieBreakStrategy, StrategyDeps } from './types';

/**
 * Calculate median mention from judgment counts
 */
function calculateMedian(counts: JudgmentCounts): keyof JudgmentCounts {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 'Bad';
  
  const medianPosition = total / 2;
  let cumulative = 0;
  
  for (const mention of mentions) {
    cumulative += counts[mention];
    if (cumulative >= medianPosition) {
      return mention;
    }
  }
  
  return 'Bad';
}

/**
 * Calculate Fabre's Typical judgment score: sT = pc - qc
 */
function calculateTypicalScore(counts: JudgmentCounts, median: keyof JudgmentCounts): number {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  
  const medianIndex = mentions.indexOf(median);
  
  // pc: proportion strictly above median (better mentions)
  let aboveCount = 0;
  for (let i = 0; i < medianIndex; i++) {
    aboveCount += counts[mentions[i]];
  }
  const pc = aboveCount / total;
  
  // qc: proportion strictly below median (worse mentions)
  let belowCount = 0;
  for (let i = medianIndex + 1; i < mentions.length; i++) {
    belowCount += counts[mentions[i]];
  }
  const qc = belowCount / total;
  
  // Typical judgment score: sT = pc - qc
  const sT = pc - qc;
  
  return sT;
}

/**
 * Compare two candidates using Fabre's Typical judgment method
 */
function compareTypical(
  countsA: JudgmentCounts,
  countsB: JudgmentCounts,
  deps: StrategyDeps
): MJComparison {
  const medianA = calculateMedian(countsA);
  const medianB = calculateMedian(countsB);
  
  // First compare by median mention
  const medianComparison = deps.compareMentions(medianA, medianB);
  
  if (medianComparison !== 0) {
    return {
      winner: medianComparison > 0 ? 'A' : 'B',
      iterations: [{
        mention: medianComparison > 0 ? medianA : medianB,
        percentageA: 0,
        percentageB: 0,
        strengthA: 0,
        strengthB: 0,
        result: medianComparison > 0 ? 'A_WINS' : 'B_WINS'
      }],
      finalResult: `${medianComparison > 0 ? 'A' : 'B'} wins on median mention: ${medianComparison > 0 ? medianA : medianB} vs ${medianComparison > 0 ? medianB : medianA}`
    };
  }
  
  // Tied on median - use Typical judgment tie-breaking
  const scoreA = calculateTypicalScore(countsA, medianA);
  const scoreB = calculateTypicalScore(countsB, medianB);
  
  const scoreDiff = scoreA - scoreB;
  
  if (Math.abs(scoreDiff) < 1e-10) {
    return {
      winner: 'TIE',
      iterations: [{
        mention: medianA,
        percentageA: scoreA,
        percentageB: scoreB,
        strengthA: scoreA,
        strengthB: scoreB,
        result: 'TIE'
      }],
      finalResult: `Perfect tie on median ${medianA} with identical Typical scores: ${scoreA.toFixed(4)}`
    };
  }
  
  return {
    winner: scoreDiff > 0 ? 'A' : 'B',
    iterations: [{
      mention: medianA,
      percentageA: scoreA,
      percentageB: scoreB,
      strengthA: scoreA,
      strengthB: scoreB,
      result: scoreDiff > 0 ? 'A_WINS' : 'B_WINS'
    }],
    finalResult: `${scoreDiff > 0 ? 'A' : 'B'} wins on Typical judgment score: ${scoreA.toFixed(4)} vs ${scoreB.toFixed(4)} (median: ${medianA})`
  };
}

const fabresTypical: TieBreakStrategy = {
  key: 'fabre-typical',
  label: 'Fabre\'s Typical Judgment',
  description: 'Tie-breaking using Fabre\'s Typical judgment score: sT = pc - qc (proportion above minus proportion below median)',
  compare: compareTypical
};

export default fabresTypical;
