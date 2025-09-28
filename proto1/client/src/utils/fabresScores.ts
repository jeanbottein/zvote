/**
 * Fabre's Tie-Breaking Score Calculations
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 * 
 * Provides utility functions to calculate Fabre's three tie-breaking scores:
 * - Typical judgment score: sT = pc - qc
 * - Usual judgment score: sU = (pc - qc) / rc
 * - Central judgment score: sC = pc / qc
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
 * Calculate Fabre's Typical judgment score: sT = pc - qc
 */
export function calculateTypicalScore(counts: JudgmentCounts): number {
  const median = calculateMedian(counts);
  const { pc, qc } = calculateProportions(counts, median);
  return pc - qc;
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
 * Calculate Fabre's Central judgment score: sC = pc / qc
 * Handles edge cases when qc = 0 or pc = 0
 */
export function calculateCentralScore(counts: JudgmentCounts): number {
  const median = calculateMedian(counts);
  const { pc, qc } = calculateProportions(counts, median);
  
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
  
  return pc / qc;
}

/**
 * Calculate all three Fabre's scores at once
 */
export function calculateAllFabresScores(counts: JudgmentCounts) {
  return {
    typical: calculateTypicalScore(counts),
    usual: calculateUsualScore(counts),
    central: calculateCentralScore(counts)
  };
}

/**
 * Format Fabre's score for display
 */
export function formatFabresScore(score: number, method: 'typical' | 'usual' | 'central'): string {
  if (score === Number.POSITIVE_INFINITY) {
    return '∞';
  }
  
  if (score === Number.NEGATIVE_INFINITY) {
    return '-∞';
  }
  
  // Different precision for different methods
  switch (method) {
    case 'typical':
      return score.toFixed(3); // Usually between -1 and 1
    case 'usual':
      return score.toFixed(2); // Can be larger values
    case 'central':
      return score.toFixed(2); // Ratio, can be large
    default:
      return score.toFixed(3);
  }
}

/**
 * Get human-readable explanation of Fabre's score
 */
export function explainFabresScore(score: number, method: 'typical' | 'usual' | 'central'): string {
  switch (method) {
    case 'typical':
      if (score > 0) return 'More supporters than opponents';
      if (score < 0) return 'More opponents than supporters';
      return 'Equal supporters and opponents';
      
    case 'usual':
      if (score > 0) return 'Supporters outweigh opponents (normalized by median)';
      if (score < 0) return 'Opponents outweigh supporters (normalized by median)';
      return 'Balanced support (normalized by median)';
      
    case 'central':
      if (score === Number.POSITIVE_INFINITY) return 'No opponents (universal approval)';
      if (score === 0) return 'No supporters (universal opposition)';
      if (score > 1) return 'Supporters outnumber opponents';
      if (score < 1) return 'Opponents outnumber supporters';
      return 'Equal supporters and opponents';
      
    default:
      return 'Unknown scoring method';
  }
}
