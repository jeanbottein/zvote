// Majority Judgment Algorithm Implementation
// Pluggable tie-break strategies (default: Jeanbottein iterative truncation)
import { getStrategyByKey, getActiveStrategyKey } from './tiebreak';
import type { TieBreakStrategy } from './tiebreak/types';
import { calculateAllFabresScores } from './fabresScores';

export type JudgmentCounts = {
  Bad: number;
  Inadequate: number;
  Passable: number;
  Fair: number;
  Good: number;
  VeryGood: number;
  Excellent: number;
};

export type MJAnalysis = {
  // Majority mention (median)
  majorityMention: keyof JudgmentCounts;
  majorityPercentage: number;
  
  // Second mention (first tie-breaking iteration)
  secondMention: keyof JudgmentCounts | null;
  secondPercentage: number;
  
  // Tie-breaking iterations
  iterations: Array<{
    mention: keyof JudgmentCounts;
    percentage: number;
    votesRemaining: number;
  }>;
  
  // Ranking information
  rank: number;
  
  // Fabre's tie-breaking scores (when applicable)
  fabresScores?: {
    typical?: number;    // sT = pc - qc
    usual?: number;      // sU = (pc - qc) / rc
    central?: number;    // sC = pc / qc
  };
  
  // Display helpers
  displaySummary: string;
  comparisonSignature: string;
};

/**
 * MJ Comparison Result for pairwise comparisons
 */
export type MJComparison = {
  winner: 'A' | 'B' | 'TIE';
  iterations: Array<{
    mention: keyof JudgmentCounts;
    percentageA: number;
    percentageB: number;
    strengthA: number;
    strengthB: number;
    result: 'A_WINS' | 'B_WINS' | 'TIE';
  }>;
  finalResult: string; // Human readable explanation
  
  // Fabre's scores (when using Fabre's methods)
  fabresScores?: {
    scoreA?: number;
    scoreB?: number;
    method?: 'typical' | 'usual' | 'central';
  };
};

/**
 * Compute Majority Judgment analysis for a single option
 */
export function computeMJAnalysis(
  judgmentCounts: JudgmentCounts
): MJAnalysis {
  const totalBallots = Object.values(judgmentCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalBallots === 0) {
    return {
      majorityMention: 'Bad',
      majorityPercentage: 0,
      secondMention: null,
      secondPercentage: 0,
      iterations: [],
      rank: 1,
      displaySummary: 'No votes',
      comparisonSignature: 'EMPTY',
    };
  }

  // Mention levels from best to worst (for "at least X" calculation)
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];

  // Current vote counts (will be modified during iterations)
  const currentCounts = { ...judgmentCounts };
  let currentTotal = totalBallots;
  const iterations: MJAnalysis['iterations'] = [];

  // Main MJ Algorithm Loop
  while (currentTotal > 0) {
    let bestMention: keyof JudgmentCounts | null = null;
    let bestPercentage = 0;

    // Find the best mention with ≥50% "at least" support
    for (const mention of mentions) {
      // Calculate "at least X" percentage
      const atLeastCount = mentions
        .slice(0, mentions.indexOf(mention) + 1)
        .reduce((sum, m) => sum + currentCounts[m], 0);
      
      const atLeastPercentage = (atLeastCount / currentTotal) * 100;

      if (atLeastPercentage >= 50.0) {
        bestMention = mention;
        bestPercentage = atLeastPercentage;
        break; // First majority mention is the best (highest quality)
      }
    }

    if (bestMention) {
      iterations.push({
        mention: bestMention,
        percentage: bestPercentage,
        votesRemaining: currentTotal,
      });


      // Remove this mention's votes for next iteration
      const countToRemove = currentCounts[bestMention];
      currentCounts[bestMention] = 0;
      currentTotal -= countToRemove;

      // Remove all mentions above this one (corrected MJ logic!)
      const mentionIndex = mentions.indexOf(bestMention);
      let totalRemoved = 0;
      
      for (let i = 0; i <= mentionIndex; i++) {
        totalRemoved += currentCounts[mentions[i]];
        currentCounts[mentions[i]] = 0;
      }
      
      currentTotal -= totalRemoved;
    } else {
      break; // No more majorities possible
    }
  }

  // Extract results
  const majorityIteration = iterations[0];
  const secondIteration = iterations[1] || null;

  // Calculate Fabre's tie-breaking scores
  const fabresScores = calculateAllFabresScores(judgmentCounts);

  return {
    majorityMention: majorityIteration?.mention || 'Bad',
    majorityPercentage: majorityIteration?.percentage || 0,
    
    secondMention: secondIteration?.mention || null,
    secondPercentage: secondIteration?.percentage || 0,
    
    iterations,
    
    // Ranking will be computed separately
    rank: 1,
    
    // Fabre's tie-breaking scores
    fabresScores,
    
    displaySummary: createDisplaySummary(majorityIteration?.mention || 'Bad', majorityIteration?.percentage || 0),
    comparisonSignature: createComparisonSignature(iterations),
  };
}

// Helper function to create display summary
function createDisplaySummary(mention: keyof JudgmentCounts, percentage: number): string {
  const percentageText = percentage > 0 ? ` (${percentage.toFixed(1)}%)` : '';
  return `${mention}${percentageText}`;
}

// Helper function to create comparison signature
function createComparisonSignature(iterations: MJAnalysis['iterations']): string {
  return iterations
    .map(iter => `${iter.mention}:${iter.percentage.toFixed(1)}`)
    .join('|');
}

// Helper to build strategy deps without exposing internal shapes
function makeStrategyDeps() {
  return {
    computeMJAnalysis: (counts: JudgmentCounts) => {
      const { iterations } = computeMJAnalysis(counts);
      // Convert to expected format for backward compatibility
      const compatibleIterations = iterations.map(iter => ({
        mention: iter.mention,
        percentage: iter.percentage,
        strengthPercent: Math.max(0, iter.percentage - 50.0)
      }));
      return { iterations: compatibleIterations };
    },
    compareMentions,
  } as const;
}

/**
 * Compare two options using MJ algorithm
 */
export function compareMJ(
  countsA: JudgmentCounts, 
  countsB: JudgmentCounts
): MJComparison {
  const strategy: TieBreakStrategy = getStrategyByKey(getActiveStrategyKey());
  return strategy.compare(countsA, countsB, makeStrategyDeps());
}

// Helper function to get mention quality value
function getMentionValue(mention: keyof JudgmentCounts): number {
  const values = {
    'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3, 'Passable': 2, 'Inadequate': 1, 'Bad': 0
  };
  return values[mention];
}

// Helper function to compare mention quality
function compareMentions(a: keyof JudgmentCounts, b: keyof JudgmentCounts): number {
  return getMentionValue(b) - getMentionValue(a); // Higher quality = lower index
}

// Helper function to find the best majority mention among options
function findBestMajorityMention<T extends { mjAnalysis: MJAnalysis }>(options: T[]): keyof JudgmentCounts {
  const mentions = options.map(option => option.mjAnalysis.majorityMention);
  const order: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  // Find the mention with the lowest index (best quality)
  let bestMention = mentions[0];
  let bestIndex = order.indexOf(bestMention);
  
  for (const mention of mentions) {
    const index = order.indexOf(mention);
    if (index < bestIndex) {
      bestMention = mention;
      bestIndex = index;
    }
  }
  
  return bestMention;
}



/**
 * Rank multiple options using the active tie-breaking strategy
 */
export function rankOptions<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(
  options: T[],
  strategyKey?: string
): Array<T & { mjAnalysis: MJAnalysis }> {
  // Step 1: Calculate basic MJ analysis for each option
  const analyzed = options.map(option => {
    const counts: JudgmentCounts = {
      Bad: option.judgment_counts?.Bad || 0,
      Inadequate: option.judgment_counts?.Inadequate || 0,
      Passable: option.judgment_counts?.Passable || 0,
      Fair: option.judgment_counts?.Fair || 0,
      Good: option.judgment_counts?.Good || 0,
      VeryGood: option.judgment_counts?.VeryGood || 0,
      Excellent: option.judgment_counts?.Excellent || 0,
    };
    const totalBallots = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    const mjAnalysis = computeMJAnalysis(counts);
    
    return {
      ...option,
      mjAnalysis,
      _counts: counts,
      _total: totalBallots
    };
  });

  // Step 2: Rank options using Fabre's method
  const remainingOptions = [...analyzed];
  let currentRank = 1;
  let iterationCount = 0;
  const maxIterations = options.length * 2; // Safety limit

  while (remainingOptions.length > 0 && iterationCount < maxIterations) {
    iterationCount++;
    
    // Step 2a: Find the best majority mention among remaining options
    const bestMajorityMention = findBestMajorityMention(remainingOptions);
    
    // Step 2b: Group options with the best majority mention
    const candidatesWithBestMention = remainingOptions.filter(
      option => option.mjAnalysis.majorityMention === bestMajorityMention
    );

    // Safety check: ensure we have candidates
    if (candidatesWithBestMention.length === 0) {
      break;
    }

    // Step 2c: Apply tie-breaking using selected strategy
    const prevActiveKey = getActiveStrategyKey();
    // Temporarily force requested strategy for this ranking pass
    const getStrategy = () => getStrategyByKey(strategyKey || prevActiveKey);
    const winners = (() => {
      // Use a local pairwise compare from the resolved strategy
      const strategy = getStrategy();
      if (candidatesWithBestMention.length <= 1) return candidatesWithBestMention;
      const w: typeof candidatesWithBestMention = [];
      for (const cand of candidatesWithBestMention) {
        let ok = true;
        for (const oth of candidatesWithBestMention) {
          if (cand === oth) continue;
          const cmp = strategy.compare(cand._counts, oth._counts, makeStrategyDeps());
          if (cmp.winner === 'B') { ok = false; break; }
        }
        if (ok) w.push(cand);
      }
      return w.length > 0 ? w : candidatesWithBestMention;
    })();

    // Safety check: ensure we have winners and they're making progress
    if (winners.length === 0 || winners.length > remainingOptions.length) {
      // Fallback: assign current rank to all remaining options
      for (const option of remainingOptions) {
        option.mjAnalysis.rank = currentRank;
      }
      break;
    }

    // Step 2d: Assign ranks
    for (const winner of winners) {
      winner.mjAnalysis.rank = currentRank;
    }

    // Step 2e: Remove winners from remaining options and update rank
    winners.forEach((winner: any) => {
      const index = remainingOptions.indexOf(winner);
      if (index !== -1) {
        remainingOptions.splice(index, 1);
      }
    });
    
    currentRank += winners.length;
  }

  // Safety fallback: if we hit max iterations, assign remaining options
  if (remainingOptions.length > 0) {
    for (const option of remainingOptions) {
      option.mjAnalysis.rank = currentRank;
    }
  }

  // Step 3: Sort by rank and return
  analyzed.sort((a, b) => a.mjAnalysis.rank - b.mjAnalysis.rank);
  return analyzed.map(({ _counts, _total, ...option }) => option) as Array<T & { mjAnalysis: MJAnalysis }>;
}

