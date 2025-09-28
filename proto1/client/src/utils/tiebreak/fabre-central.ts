/**
 * Adrien Fabre's Central Judgment Tie-Breaking Method
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 * 
 * For candidates tied on the median mention, calculate:
 * - pc: proportion of voters rating strictly above the median
 * - qc: proportion of voters rating strictly below the median  
 * - rc: proportion of voters rating exactly the median
 * 
 * Central judgment score: compares ratio of proponents to opponents
 * sC = pc / qc (when qc > 0), with special handling for edge cases
 * 
 * This method focuses on the ratio between supporters and opponents,
 * providing insight into the polarization around the median.
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
 * Calculate Fabre's Central judgment score: ratio of proponents to opponents
 * Handles edge cases when qc = 0 or pc = 0
 */
function calculateCentralScore(counts: JudgmentCounts, median: keyof JudgmentCounts): number {
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
  
  // Handle edge cases for Central judgment
  if (qc === 0) {
    // No opponents - candidate is strongly favored
    if (pc > 0) {
      return Number.POSITIVE_INFINITY; // Infinite ratio favoring this candidate
    } else {
      return 1; // All votes at median, neutral
    }
  }
  
  if (pc === 0) {
    // No proponents - candidate is strongly opposed
    return 0; // Zero ratio
  }
  
  // Central judgment score: sC = pc / qc
  const sC = pc / qc;
  
  return sC;
}

/**
 * Compare two candidates using Fabre's Central judgment method
 */
function compareCentral(
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
  
  // Tied on median - use Central judgment tie-breaking
  const scoreA = calculateCentralScore(countsA, medianA);
  const scoreB = calculateCentralScore(countsB, medianB);
  
  // Handle infinite scores
  if (scoreA === Number.POSITIVE_INFINITY && scoreB === Number.POSITIVE_INFINITY) {
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
      finalResult: `Perfect tie on median ${medianA} - both have infinite Central scores (no opponents)`
    };
  }
  
  if (scoreA === Number.POSITIVE_INFINITY) {
    return {
      winner: 'A',
      iterations: [{
        mention: medianA,
        percentageA: scoreA,
        percentageB: scoreB,
        strengthA: scoreA,
        strengthB: scoreB,
        result: 'A_WINS'
      }],
      finalResult: `A wins with infinite Central score (no opponents) vs ${scoreB.toFixed(4)} (median: ${medianA})`
    };
  }
  
  if (scoreB === Number.POSITIVE_INFINITY) {
    return {
      winner: 'B',
      iterations: [{
        mention: medianA,
        percentageA: scoreA,
        percentageB: scoreB,
        strengthA: scoreA,
        strengthB: scoreB,
        result: 'B_WINS'
      }],
      finalResult: `B wins with infinite Central score (no opponents) vs ${scoreA.toFixed(4)} (median: ${medianA})`
    };
  }
  
  // Compare finite scores
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
      finalResult: `Perfect tie on median ${medianA} with identical Central scores: ${scoreA.toFixed(4)}`
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
    finalResult: `${scoreDiff > 0 ? 'A' : 'B'} wins on Central judgment score: ${scoreA.toFixed(4)} vs ${scoreB.toFixed(4)} (median: ${medianA})`
  };
}

const fabresCentral: TieBreakStrategy = {
  key: 'fabre-central',
  label: 'Fabre\'s Central Judgment',
  description: 'Tie-breaking using Fabre\'s Central judgment score: sC = pc / qc (ratio of proponents to opponents)',
  compare: compareCentral
};

export default fabresCentral;
