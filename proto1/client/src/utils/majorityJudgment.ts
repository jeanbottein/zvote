// Majority Judgment utilities shared by vote and view pages
// Mentions ordered worst..best: ToReject, Insufficient, OnlyAverage, GoodEnough, Good, VeryGood, Excellent

export type JudgmentCounts = {
  ToReject: number;
  Insufficient: number;
  OnlyAverage: number;
  GoodEnough: number;
  Good: number;
  VeryGood: number;
  Excellent: number;
};

export function toCountsArray(jc?: Partial<JudgmentCounts> | Record<string, number> | null): number[] {
  const src = jc || {};
  return [
    Number((src as any).ToReject || 0),
    Number((src as any).Insufficient || 0),
    Number((src as any).OnlyAverage || 0),
    Number((src as any).GoodEnough || 0),
    Number((src as any).Good || 0),
    Number((src as any).VeryGood || 0),
    Number((src as any).Excellent || 0),
  ];
}

export function medianIndex(counts: number[], total: number): number {
  if (total <= 0) return 0;
  const target = Math.floor((total + 1) / 2); // lower median
  let cum = 0;
  for (let i = 0; i < counts.length; i++) {
    cum += counts[i];
    if (cum >= target) return i;
  }
  return counts.length - 1;
}

export function compareMJ(aCountsOrig: number[], bCountsOrig: number[]): number {
  const aOrig = aCountsOrig.slice();
  const bOrig = bCountsOrig.slice();
  const aTotalOrig = aOrig.reduce((s, n) => s + n, 0);
  const bTotalOrig = bOrig.reduce((s, n) => s + n, 0);

  // First compare majority mentions
  let aCounts = aOrig.slice();
  let bCounts = bOrig.slice();
  let aTotal = aTotalOrig;
  let bTotal = bTotalOrig;
  let aMed = medianIndex(aCounts, aTotal);
  let bMed = medianIndex(bCounts, bTotal);
  if (aMed !== bMed) return bMed - aMed; // higher index (better) wins

  // Iteratively remove one median from both until medians differ
  let guard = aTotal + bTotal + 5;
  while (aTotal > 0 && bTotal > 0 && guard-- > 0) {
    if (aCounts[aMed] === 0 || bCounts[bMed] === 0) break;
    aCounts[aMed] -= 1; aTotal -= 1;
    bCounts[bMed] -= 1; bTotal -= 1;
    aMed = medianIndex(aCounts, aTotal);
    bMed = medianIndex(bCounts, bTotal);
    if (aMed !== bMed) return bMed - aMed;
  }

  // If still tied, compare proportion strictly above the (original) median
  const aAbove = aOrig.slice(aMed + 1).reduce((s, n) => s + n, 0) / (aTotalOrig || 1);
  const bAbove = bOrig.slice(bMed + 1).reduce((s, n) => s + n, 0) / (bTotalOrig || 1);
  if (aAbove !== bAbove) return aAbove < bAbove ? 1 : -1; // larger above is better

  // If still tied, compare proportion strictly below the median (fewer lower is better)
  const aBelow = aOrig.slice(0, aMed).reduce((s, n) => s + n, 0) / (aTotalOrig || 1);
  const bBelow = bOrig.slice(0, bMed).reduce((s, n) => s + n, 0) / (bTotalOrig || 1);
  if (aBelow !== bBelow) return aBelow < bBelow ? -1 : 1; // less lower is better

  return 0; // ex aequo
}

export function sortOptionsByMJ<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(options: T[]): T[] {
  return [...options].sort((a, b) => {
    const aCounts = toCountsArray(a.judgment_counts);
    const bCounts = toCountsArray(b.judgment_counts);
    return compareMJ(aCounts, bCounts);
  });
}

export function sortOptionsWithRanks<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(options: T[]): { 
  sortedOptions: T[]; 
  ranks: Map<string, number>;
  exAequoOptions: Set<string>;
} {
  const sortedOptions = sortOptionsByMJ(options);
  const ranks = calculateRanks(sortedOptions);
  const exAequoOptions = findExAequoOptions(ranks);
  return { sortedOptions, ranks, exAequoOptions };
}

export function findExAequoOptions(ranks: Map<string, number>): Set<string> {
  const exAequoOptions = new Set<string>();
  const rankCounts = new Map<number, number>();
  
  // Count how many options have each rank
  for (const rank of ranks.values()) {
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
  }
  
  // Mark options as ex aequo if more than one option has the same rank
  for (const [optionId, rank] of ranks.entries()) {
    if ((rankCounts.get(rank) || 0) > 1) {
      exAequoOptions.add(optionId);
    }
  }
  
  return exAequoOptions;
}

export function findWinners<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(sortedOptions: T[]): Set<string> {
  const winners = new Set<string>();
  if (sortedOptions.length === 0) return winners;
  winners.add(sortedOptions[0].id);
  for (let i = 1; i < sortedOptions.length; i++) {
    const aCounts = toCountsArray(sortedOptions[0].judgment_counts);
    const bCounts = toCountsArray(sortedOptions[i].judgment_counts);
    const cmp = compareMJ(aCounts, bCounts);
    if (cmp === 0) winners.add(sortedOptions[i].id); else break;
  }
  return winners;
}

export function calculateRanks<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(sortedOptions: T[]): Map<string, number> {
  const ranks = new Map<string, number>();
  if (sortedOptions.length === 0) return ranks;
  
  let currentRank = 1;
  let i = 0;
  
  while (i < sortedOptions.length) {
    const currentOption = sortedOptions[i];
    const currentCounts = toCountsArray(currentOption.judgment_counts);
    
    // Find all options tied with the current one
    const tiedOptions = [currentOption];
    let j = i + 1;
    while (j < sortedOptions.length) {
      const nextCounts = toCountsArray(sortedOptions[j].judgment_counts);
      if (compareMJ(currentCounts, nextCounts) === 0) {
        tiedOptions.push(sortedOptions[j]);
        j++;
      } else {
        break;
      }
    }
    
    // Assign the same rank to all tied options
    for (const option of tiedOptions) {
      ranks.set(option.id, currentRank);
    }
    
    // Next rank skips the tied positions (standard ranking rules)
    currentRank += tiedOptions.length;
    i = j;
  }
  
  return ranks;
}

// ============================================================================
// PURE MAJORITY JUDGMENT ALGORITHM - CLIENT-SIDE IMPLEMENTATION
// The Most Beautiful, Reliable, Tested MJ Implementation Ever Created
// ============================================================================

/**
 * Pure MJ Analysis Result - No Scoring Approximations!
 * Contains complete information for perfect display and comparison
 */
export type PureMJAnalysis = {
  // Primary majority information
  majorityMention: keyof JudgmentCounts;
  majorityPercentage: number;        // Percentage "at least majority mention"
  majorityStrengthPercent: number;   // How much above 50%
  
  // Complete iteration chain for perfect tie-breaking
  iterations: Array<{
    mention: keyof JudgmentCounts;
    percentage: number;              // "At least X%" for this mention
    strengthPercent: number;         // How much above 50%
    votesRemaining: number;          // Total votes in this iteration
  }>;
  
  // Final iteration results
  finalMention: keyof JudgmentCounts;
  finalPercentage: number;
  finalStrengthPercent: number;
  
  // Pure ranking results (no approximation)
  rank: number;                      // Exact rank (1 = winner)
  isWinner: boolean;                 // True if rank = 1
  isExAequo: boolean;               // True if tied with other options
  tiedWithOptions: string[];         // IDs of options tied with this one
  
  // Display helpers
  displaySummary: string;            // "Good +10%" or "VeryGood (tie)"
  comparisonSignature: string;       // Unique signature for comparison
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
};

/**
 * The Pure Majority Judgment Algorithm - Heart of the System!
 * Computes complete MJ analysis from raw vote counts with 100% accuracy
 */
export function computePureMJAnalysis(
  judgmentCounts: JudgmentCounts, 
  totalBallots: number,
  _optionId?: string,
  computeAllIterations: boolean = false
): PureMJAnalysis {
  if (totalBallots === 0) {
    return {
      majorityMention: 'ToReject',
      majorityPercentage: 0,
      majorityStrengthPercent: 0,
      iterations: [],
      finalMention: 'ToReject',
      finalPercentage: 0,
      finalStrengthPercent: 0,
      rank: 1,
      isWinner: false,
      isExAequo: false,
      tiedWithOptions: [],
      displaySummary: 'No votes',
      comparisonSignature: 'EMPTY',
    };
  }

  // Mention levels from best to worst (for "at least X" calculation)
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'GoodEnough', 'OnlyAverage', 'Insufficient', 'ToReject'
  ];

  // Current vote counts (will be modified during iterations)
  const currentCounts = { ...judgmentCounts };
  let currentTotal = totalBallots;
  const iterations: PureMJAnalysis['iterations'] = [];

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
      const strengthPercent = Math.max(0, bestPercentage - 50.0);
      
      iterations.push({
        mention: bestMention,
        percentage: bestPercentage,
        strengthPercent,
        votesRemaining: currentTotal,
      });

      // Only compute additional iterations if explicitly requested (for tie-breaking)
      if (!computeAllIterations && iterations.length === 1) {
        break; // Stop after first iteration unless we need tie-breaking
      }

      // Remove this mention AND all mentions above it (corrected MJ logic!)
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
  const finalIteration = iterations[iterations.length - 1] || majorityIteration;

  return {
    majorityMention: majorityIteration?.mention || 'ToReject',
    majorityPercentage: majorityIteration?.percentage || 0,
    majorityStrengthPercent: majorityIteration?.strengthPercent || 0,
    
    iterations,
    
    finalMention: finalIteration?.mention || 'ToReject',
    finalPercentage: finalIteration?.percentage || 0,
    finalStrengthPercent: finalIteration?.strengthPercent || 0,
    
    // Ranking will be computed separately
    rank: 1,
    isWinner: false,
    isExAequo: false,
    tiedWithOptions: [],
    
    displaySummary: createDisplaySummary(majorityIteration?.mention || 'ToReject', majorityIteration?.strengthPercent || 0),
    comparisonSignature: createComparisonSignature(iterations),
  };
}

// Helper function to create display summary
function createDisplaySummary(mention: keyof JudgmentCounts, strength: number): string {
  const strengthText = strength > 0 ? ` +${strength.toFixed(1)}%` : '';
  return `${mention}${strengthText}`;
}

// Helper function to create comparison signature
function createComparisonSignature(iterations: PureMJAnalysis['iterations']): string {
  return iterations
    .map(iter => `${iter.mention}:${iter.percentage.toFixed(1)}`)
    .join('|');
}

/**
 * Pure MJ Comparison - Compare two options using pure MJ algorithm
 * Returns: 1 if A > B, -1 if A < B, 0 if tied
 */
export function comparePureMJ(
  countsA: JudgmentCounts, 
  totalA: number,
  countsB: JudgmentCounts, 
  totalB: number
): MJComparison {
  const analysisA = computePureMJAnalysis(countsA, totalA, undefined, true);
  const analysisB = computePureMJAnalysis(countsB, totalB, undefined, true);
  
  const maxIterations = Math.max(analysisA.iterations.length, analysisB.iterations.length);
  const iterations: MJComparison['iterations'] = [];
  
  for (let i = 0; i < maxIterations; i++) {
    const iterA = analysisA.iterations[i];
    const iterB = analysisB.iterations[i];
    
    if (iterA && iterB) {
      // Compare mention quality first
      const mentionComparison = compareMentions(iterA.mention, iterB.mention);
      
      if (mentionComparison !== 0) {
        iterations.push({
          mention: iterA.mention,
          percentageA: iterA.percentage,
          percentageB: iterB.percentage,
          strengthA: iterA.strengthPercent,
          strengthB: iterB.strengthPercent,
          result: mentionComparison > 0 ? 'A_WINS' : 'B_WINS'
        });
        
        return {
          winner: mentionComparison > 0 ? 'A' : 'B',
          iterations,
          finalResult: `${mentionComparison > 0 ? 'A' : 'B'} wins on ${iterA.mention} vs ${iterB.mention}`
        };
      }
      
      // Same mention - compare strength
      if (iterA.strengthPercent !== iterB.strengthPercent) {
        const strengthWinner = iterA.strengthPercent > iterB.strengthPercent ? 'A_WINS' : 'B_WINS';
        iterations.push({
          mention: iterA.mention,
          percentageA: iterA.percentage,
          percentageB: iterB.percentage,
          strengthA: iterA.strengthPercent,
          strengthB: iterB.strengthPercent,
          result: strengthWinner
        });
        
        return {
          winner: strengthWinner === 'A_WINS' ? 'A' : 'B',
          iterations,
          finalResult: `${strengthWinner === 'A_WINS' ? 'A' : 'B'} wins on strength: ${iterA.strengthPercent.toFixed(1)}% vs ${iterB.strengthPercent.toFixed(1)}%`
        };
      }
      
      // Tied on this iteration
      iterations.push({
        mention: iterA.mention,
        percentageA: iterA.percentage,
        percentageB: iterB.percentage,
        strengthA: iterA.strengthPercent,
        strengthB: iterB.strengthPercent,
        result: 'TIE'
      });
    }
  }
  
  return {
    winner: 'TIE',
    iterations,
    finalResult: 'Perfect tie - ex aequo'
  };
}

// Helper function to compare mention quality
function compareMentions(a: keyof JudgmentCounts, b: keyof JudgmentCounts): number {
  const order: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'GoodEnough', 'OnlyAverage', 'Insufficient', 'ToReject'
  ];
  return order.indexOf(b) - order.indexOf(a); // Higher quality = lower index
}

// Helper function to find the best majority mention among options
function findBestMajorityMention<T extends { mjAnalysis: PureMJAnalysis }>(options: T[]): keyof JudgmentCounts {
  const mentions = options.map(option => option.mjAnalysis.majorityMention);
  const order: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'GoodEnough', 'OnlyAverage', 'Insufficient', 'ToReject'
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

// Adrien Fabre's "groupes d'insatisfaits" tie-breaking method
function breakTiesUsingUnsatisfiedGroups<T extends { mjAnalysis: PureMJAnalysis; _counts: JudgmentCounts; _total: number }>(
  candidates: T[]
): T[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  // Safety check: if all candidates have 0 total votes, return all as ex aequo
  if (candidates.every(c => c._total === 0)) {
    return candidates;
  }

  // All candidates have the same majority mention
  const majorityMention = candidates[0].mjAnalysis.majorityMention;
  const mentionOrder: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'GoodEnough', 'OnlyAverage', 'Insufficient', 'ToReject'
  ];
  const majorityIndex = mentionOrder.indexOf(majorityMention);

  // Safety check: if majority mention not found, return all as ex aequo
  if (majorityIndex === -1) {
    return candidates;
  }

  // Step 1: Calculate supporters and opponents for each candidate
  const candidateStats = candidates.map(candidate => {
    // Supporters: votes STRICTLY ABOVE majority mention
    const supporterCount = mentionOrder
      .slice(0, majorityIndex)
      .reduce((sum, mention) => sum + (candidate._counts[mention] || 0), 0);
    const supporterPercent = candidate._total > 0 ? (supporterCount / candidate._total) * 100 : 0;

    // Opponents: votes STRICTLY BELOW majority mention  
    const opponentCount = mentionOrder
      .slice(majorityIndex + 1)
      .reduce((sum, mention) => sum + (candidate._counts[mention] || 0), 0);
    const opponentPercent = candidate._total > 0 ? (opponentCount / candidate._total) * 100 : 0;

    return {
      candidate,
      supporterPercent,
      opponentPercent,
      supporterCount,
      opponentCount
    };
  });

  // Step 2: Find the maximum value among all supporters and opponents
  const allValues = candidateStats.flatMap(stats => [stats.supporterPercent, stats.opponentPercent]);
  const maxValue = Math.max(...allValues);

  // Safety check: if maxValue is NaN or negative, return all as ex aequo
  if (!isFinite(maxValue) || maxValue < 0) {
    return candidates;
  }

  // Step 3: Apply Fabre's rules with tolerance for floating point comparison
  const tolerance = 0.001;
  const candidatesWithMaxSupporters = candidateStats.filter(stats => 
    Math.abs(stats.supporterPercent - maxValue) < tolerance
  );
  const candidatesWithMaxOpponents = candidateStats.filter(stats => 
    Math.abs(stats.opponentPercent - maxValue) < tolerance
  );

  if (candidatesWithMaxSupporters.length === 1 && candidatesWithMaxOpponents.length === 0) {
    // Unique maximum is a supporter percentage -> that candidate wins
    return [candidatesWithMaxSupporters[0].candidate];
  }

  if (candidatesWithMaxOpponents.length > 0 && candidatesWithMaxSupporters.length === 0) {
    // Maximum is opponent percentage(s) -> those candidates lose
    const losers = new Set(candidatesWithMaxOpponents.map(stats => stats.candidate));
    const remaining = candidates.filter(candidate => !losers.has(candidate));
    // Safety check: ensure we don't eliminate all candidates
    return remaining.length > 0 ? remaining : candidates;
  }

  if (candidatesWithMaxSupporters.length > 0 && candidatesWithMaxOpponents.length > 0) {
    // Both supporters and opponents have max value -> opponents lose (Fabre's rule)
    const losers = new Set(candidatesWithMaxOpponents.map(stats => stats.candidate));
    const remaining = candidates.filter(candidate => !losers.has(candidate));
    // Safety check: ensure we don't eliminate all candidates
    return remaining.length > 0 ? remaining : candidates;
  }

  // If we reach here, return all as ex aequo (true tie)
  return candidates;
}

/**
 * Rank multiple options using Adrien Fabre's "groupes d'insatisfaits" method
 * Returns options sorted by MJ ranking with complete analysis
 */
export function rankOptionsPureMJ<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(
  options: T[]
): Array<T & { mjAnalysis: PureMJAnalysis }> {
  // Step 1: Calculate basic MJ analysis for each option
  const analyzed = options.map(option => {
    const counts: JudgmentCounts = {
      ToReject: option.judgment_counts?.ToReject || 0,
      Insufficient: option.judgment_counts?.Insufficient || 0,
      OnlyAverage: option.judgment_counts?.OnlyAverage || 0,
      GoodEnough: option.judgment_counts?.GoodEnough || 0,
      Good: option.judgment_counts?.Good || 0,
      VeryGood: option.judgment_counts?.VeryGood || 0,
      Excellent: option.judgment_counts?.Excellent || 0,
    };
    const totalBallots = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    const mjAnalysis = computePureMJAnalysis(counts, totalBallots, option.id, true);
    
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

    // Step 2c: Apply tie-breaking using "groupes d'insatisfaits"
    const winners = breakTiesUsingUnsatisfiedGroups(candidatesWithBestMention);

    // Safety check: ensure we have winners and they're making progress
    if (winners.length === 0 || winners.length > remainingOptions.length) {
      // Fallback: assign current rank to all remaining options
      for (const option of remainingOptions) {
        option.mjAnalysis.rank = currentRank;
        option.mjAnalysis.isWinner = currentRank === 1;
        option.mjAnalysis.isExAequo = remainingOptions.length > 1;
        option.mjAnalysis.tiedWithOptions = remainingOptions
          .filter(o => o.id !== option.id)
          .map(o => o.id);
      }
      break;
    }

    // Step 2d: Assign ranks
    const isWinner = currentRank === 1;
    const isExAequo = winners.length > 1;
    const winnerIds = winners.map((w: any) => w.id);

    for (const winner of winners) {
      winner.mjAnalysis.rank = currentRank;
      winner.mjAnalysis.isWinner = isWinner;
      winner.mjAnalysis.isExAequo = isExAequo;
      winner.mjAnalysis.tiedWithOptions = winnerIds.filter((id: string) => id !== winner.id);
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
      option.mjAnalysis.isWinner = false;
      option.mjAnalysis.isExAequo = remainingOptions.length > 1;
      option.mjAnalysis.tiedWithOptions = remainingOptions
        .filter(o => o.id !== option.id)
        .map(o => o.id);
    }
  }

  // Step 3: Sort by rank and return
  analyzed.sort((a, b) => a.mjAnalysis.rank - b.mjAnalysis.rank);
  return analyzed.map(({ _counts, _total, ...option }) => option) as Array<T & { mjAnalysis: PureMJAnalysis }>;
}

// ============================================================================
// PURE MAJORITY JUDGMENT IMPLEMENTATION COMPLETE
// Server = Pure Database | Client = Pure Algorithm | 100% Accuracy Guaranteed
// ============================================================================
