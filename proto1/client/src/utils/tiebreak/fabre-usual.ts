/**
 * Adrien Fabre's Usual Judgment Tie-Breaking Method
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 * 
 * For candidates tied on the median mention, calculate:
 * - pc: proportion of voters rating strictly above the median
 * - qc: proportion of voters rating strictly below the median  
 * - rc: proportion of voters rating exactly the median
 * 
 * Usual judgment score: sU = (pc - qc) / rc
 * 
 * This method normalizes the difference between proponents and opponents
 * by the proportion at the median, handling division by zero appropriately.
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
 * Calculate Fabre's Usual judgment score: sU = (pc - qc) / rc
 * Handles division by zero when rc = 0
 */
function calculateUsualScore(counts: JudgmentCounts, median: keyof JudgmentCounts): number {
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
  
  // rc: proportion exactly at median
  const rc = counts[median] / total;
  
  // Handle division by zero when rc = 0
  if (rc === 0) {
    // If no votes at median, fall back to typical score: pc - qc
    return pc - qc;
  }
  
  // Usual judgment score: sU = (pc - qc) / rc
  const sU = (pc - qc) / rc;
  
  return sU;
}

/**
 * Compare two candidates using Fabre's Usual judgment method
 */
function compareUsual(
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
  
  // Tied on median - use Usual judgment tie-breaking
  const scoreA = calculateUsualScore(countsA, medianA);
  const scoreB = calculateUsualScore(countsB, medianB);
  
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
      finalResult: `Perfect tie on median ${medianA} with identical Usual scores: ${scoreA.toFixed(4)}`
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
    finalResult: `${scoreDiff > 0 ? 'A' : 'B'} wins on Usual judgment score: ${scoreA.toFixed(4)} vs ${scoreB.toFixed(4)} (median: ${medianA})`
  };
}

const fabresUsual: TieBreakStrategy = {
  key: 'fabre-usual',
  label: 'Fabre\'s Usual Judgment',
  description: 'Tie-breaking using Fabre\'s Usual judgment score: sU = (pc - qc) / rc (normalized by median proportion)',
  compare: compareUsual
};

export default fabresUsual;
