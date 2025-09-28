// Majority Judgment Algorithm Implementation
// State-of-the-art MJ with Fabre's "groupes d'insatisfaits" tie-breaking method

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
  // Majority mention and strength
  majorityMention: keyof JudgmentCounts;
  majorityPercentage: number;
  majorityStrengthPercent: number;
  
  // Tie-breaking iterations
  iterations: Array<{
    mention: keyof JudgmentCounts;
    percentage: number;
    strengthPercent: number;
    votesRemaining: number;
  }>;
  
  // Final iteration results
  finalMention: keyof JudgmentCounts;
  finalPercentage: number;
  finalStrengthPercent: number;
  
  // Ranking information
  rank: number;
  
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
      majorityStrengthPercent: 0,
      iterations: [],
      finalMention: 'Bad',
      finalPercentage: 0,
      finalStrengthPercent: 0,
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
      const strengthPercent = Math.max(0, bestPercentage - 50.0);
      
      iterations.push({
        mention: bestMention,
        percentage: bestPercentage,
        strengthPercent,
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
  const finalIteration = iterations[iterations.length - 1] || majorityIteration;

  return {
    majorityMention: majorityIteration?.mention || 'Bad',
    majorityPercentage: majorityIteration?.percentage || 0,
    majorityStrengthPercent: majorityIteration?.strengthPercent || 0,
    
    iterations,
    
    finalMention: finalIteration?.mention || 'Bad',
    finalPercentage: finalIteration?.percentage || 0,
    finalStrengthPercent: finalIteration?.strengthPercent || 0,
    
    // Ranking will be computed separately
    rank: 1,
    
    displaySummary: createDisplaySummary(majorityIteration?.mention || 'Bad', majorityIteration?.strengthPercent || 0),
    comparisonSignature: createComparisonSignature(iterations),
  };
}

// Helper function to create display summary
function createDisplaySummary(mention: keyof JudgmentCounts, strength: number): string {
  const strengthText = strength > 0 ? ` +${strength.toFixed(1)}%` : '';
  return `${mention}${strengthText}`;
}

// Helper function to create comparison signature
function createComparisonSignature(iterations: MJAnalysis['iterations']): string {
  return iterations
    .map(iter => `${iter.mention}:${iter.percentage.toFixed(1)}`)
    .join('|');
}

/**
 * Compare two options using MJ algorithm
 */
export function compareMJ(
  countsA: JudgmentCounts, 
  countsB: JudgmentCounts
): MJComparison {
  const analysisA = computeMJAnalysis(countsA);
  const analysisB = computeMJAnalysis(countsB);
  
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

// Standard MJ tie-breaking using iterative comparison
function breakTiesUsingMJComparison<T extends { mjAnalysis: MJAnalysis; _counts: JudgmentCounts; _total: number }>(
  candidates: T[]
): T[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  // Use pairwise comparisons to find the best candidate(s)
  const winners: T[] = [];
  
  for (const candidate of candidates) {
    let isWinner = true;
    
    // Check if this candidate beats or ties with all others
    for (const other of candidates) {
      if (candidate === other) continue;
      
      const comparison = compareMJ(candidate._counts, other._counts);
      if (comparison.winner === 'B') {
        // This candidate loses to another, so it's not a winner
        isWinner = false;
        break;
      }
    }
    
    if (isWinner) {
      winners.push(candidate);
    }
  }
  
  // If no clear winners (shouldn't happen with proper MJ), return all as tied
  return winners.length > 0 ? winners : candidates;
}


/**
 * Rank multiple options using Fabre's tie-breaking method
 */
export function rankOptions<T extends { id: string; judgment_counts?: Partial<JudgmentCounts> }>(
  options: T[]
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

    // Step 2c: Apply tie-breaking using standard MJ comparison
    const winners = breakTiesUsingMJComparison(candidatesWithBestMention);

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

