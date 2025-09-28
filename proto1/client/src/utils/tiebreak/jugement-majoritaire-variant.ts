/**
 * Jugement-Majoritaire-Variant Tie-Breaking Method
 * 
 * Given only aggregated counters of mentions per candidate (no access to individual ballots),
 * implement a tie-breaking procedure that:
 * 
 * 1. For all candidates with the same median mention, simultaneously decrement 
 *    the count of that median mention by 1
 * 2. Recalculate the median mention for each candidate
 * 3. Remove candidates whose new median falls below the others
 * 4. Repeat until only one candidate remains or all counts become zero 
 *    (in which case true tie is declared)
 * 
 * This process simulates iterative removal of median votes in bulk, 
 * approximating the original method but adapted to aggregated data.
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
 * Get mention quality value for comparison (higher = better)
 */
function getMentionValue(mention: keyof JudgmentCounts): number {
  const values = {
    'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3, 
    'Passable': 2, 'Inadequate': 1, 'Bad': 0
  };
  return values[mention];
}

/**
 * Create a copy of judgment counts
 */
function copyJudgmentCounts(counts: JudgmentCounts): JudgmentCounts {
  return {
    Bad: counts.Bad,
    Inadequate: counts.Inadequate,
    Passable: counts.Passable,
    Fair: counts.Fair,
    Good: counts.Good,
    VeryGood: counts.VeryGood,
    Excellent: counts.Excellent
  };
}

/**
 * Check if all counts are zero
 */
function allCountsZero(counts: JudgmentCounts): boolean {
  return Object.values(counts).every(count => count === 0);
}

/**
 * Perform jugement-majoritaire-variant tie-breaking between two candidates
 */
function compareJugementMajoritaireVariant(
  countsA: JudgmentCounts,
  countsB: JudgmentCounts,
  _deps: StrategyDeps
): MJComparison {
  // Work with copies to avoid modifying originals
  let currentCountsA = copyJudgmentCounts(countsA);
  let currentCountsB = copyJudgmentCounts(countsB);
  
  const iterations: MJComparison['iterations'] = [];
  let iterationCount = 0;
  const maxIterations = 20; // Safety limit
  
  while (iterationCount < maxIterations) {
    iterationCount++;
    
    // Calculate current medians
    const medianA = calculateMedian(currentCountsA);
    const medianB = calculateMedian(currentCountsB);
    
    // Compare medians
    const medianComparison = getMentionValue(medianA) - getMentionValue(medianB);
    
    if (medianComparison !== 0) {
      // Different medians - we have a winner
      const winner = medianComparison > 0 ? 'A' : 'B';
      iterations.push({
        mention: winner === 'A' ? medianA : medianB,
        percentageA: 0,
        percentageB: 0,
        strengthA: getMentionValue(medianA),
        strengthB: getMentionValue(medianB),
        result: winner === 'A' ? 'A_WINS' : 'B_WINS'
      });
      
      return {
        winner,
        iterations,
        finalResult: `${winner} wins after ${iterationCount} iterations: ${medianA} vs ${medianB}`
      };
    }
    
    // Same median - record iteration and continue tie-breaking
    iterations.push({
      mention: medianA,
      percentageA: 0,
      percentageB: 0,
      strengthA: getMentionValue(medianA),
      strengthB: getMentionValue(medianB),
      result: 'TIE'
    });
    
    // Check if both have zero counts (perfect tie)
    if (allCountsZero(currentCountsA) && allCountsZero(currentCountsB)) {
      return {
        winner: 'TIE',
        iterations,
        finalResult: `Perfect tie after ${iterationCount} iterations - all counts exhausted`
      };
    }
    
    // Decrement median mention count by 1 for both candidates
    if (currentCountsA[medianA] > 0) {
      currentCountsA[medianA]--;
    }
    if (currentCountsB[medianB] > 0) {
      currentCountsB[medianB]--;
    }
    
    // If one candidate runs out of votes but the other doesn't, 
    // the one with remaining votes wins
    const totalA = Object.values(currentCountsA).reduce((sum, count) => sum + count, 0);
    const totalB = Object.values(currentCountsB).reduce((sum, count) => sum + count, 0);
    
    if (totalA === 0 && totalB > 0) {
      return {
        winner: 'B',
        iterations,
        finalResult: `B wins after ${iterationCount} iterations - A exhausted all votes`
      };
    }
    
    if (totalB === 0 && totalA > 0) {
      return {
        winner: 'A',
        iterations,
        finalResult: `A wins after ${iterationCount} iterations - B exhausted all votes`
      };
    }
  }
  
  // Safety fallback - should not reach here
  return {
    winner: 'TIE',
    iterations,
    finalResult: `Tie declared after maximum iterations (${maxIterations})`
  };
}

const jugementMajoritaireVariant: TieBreakStrategy = {
  key: 'jugement-majoritaire-variant',
  label: 'Jugement-Majoritaire-Variant',
  description: 'Iterative median removal: simultaneously decrement median counts and recalculate until tie is broken',
  compare: compareJugementMajoritaireVariant
};

export default jugementMajoritaireVariant;
