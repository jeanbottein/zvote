/**
 * Fabre's Usual Judgment Score Calculation
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 * 
 * Provides utility functions to calculate Fabre's Usual judgment score:
 * - Usual judgment score: sU = (pc - qc) / rc
 */

import type { JudgmentCounts } from './tiebreak/types';

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
 * Calculate proportions relative to median
 */
function calculateProportions(counts: JudgmentCounts, median: keyof JudgmentCounts) {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return { pc: 0, qc: 0, rc: 0 };
  
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
  
  return { pc, qc, rc };
}


/**
 * Calculate Fabre's Usual judgment score: sU = (pc - qc) / rc
 * Handles division by zero when rc = 0
 */
export function calculateUsualScore(counts: JudgmentCounts): number {
  const median = calculateMedian(counts);
  const { pc, qc, rc } = calculateProportions(counts, median);
  
  // Handle division by zero when rc = 0
  if (rc === 0) {
    // If no votes at median, fall back to typical score: pc - qc
    return pc - qc;
  }
  
  return (pc - qc) / rc;
}


/**
 * Format Fabre's Usual score for display
 */
export function formatFabresScore(score: number): string {
  if (score === Number.POSITIVE_INFINITY) {
    return '∞';
  }
  
  if (score === Number.NEGATIVE_INFINITY) {
    return '-∞';
  }
  
  return score.toFixed(2);
}

/**
 * Get human-readable explanation of Fabre's Usual score
 */
export function explainFabresScore(score: number): string {
  if (score > 0) return 'Supporters outweigh opponents (normalized by median)';
  if (score < 0) return 'Opponents outweigh supporters (normalized by median)';
  return 'Balanced support (normalized by median)';
}
