/**
 * Majority Judgment Algorithm with GMD's Usual Tie-Breaking
 * 
 * This implementation focuses solely on GMD's Usual judgment method
 * for tie-breaking, which has proven to be the most effective approach.
 */

import { calculateUsualScore, formatGMDsScore } from './gmdScores';
import { getStrategy } from './tiebreak';

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
  majorityMention: keyof JudgmentCounts;
  majorityPercentage: number;
  
  // GMD's Usual score instead of settling mention
  GMDsUsualScore: number;
  GMDsUsualScoreFormatted: string;
  
  iterations: Array<{
    mention: keyof JudgmentCounts;
    percentage: number;
    votesRemaining: number;
  }>;
  
  rank: number;
  isWinner: boolean;
  isExAequo: boolean;
  
  displaySummary: string;
  comparisonSignature: string;
};

/**
 * Compute majority judgment analysis for a single option
 */
export function computeMJAnalysis(judgmentCounts: JudgmentCounts): MJAnalysis {
  const totalBallots = Object.values(judgmentCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalBallots === 0) {
    const GMDsScore = calculateUsualScore(judgmentCounts);
    return {
      majorityMention: 'Bad',
      majorityPercentage: 0,
      GMDsUsualScore: GMDsScore,
      GMDsUsualScoreFormatted: formatGMDsScore(GMDsScore),
      iterations: [],
      rank: 1,
      isWinner: false,
      isExAequo: false,
      displaySummary: 'Bad (0.0%)',
      comparisonSignature: 'Bad:0.0'
    };
  }

  // Mention order from best to worst
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

      // Remove all mentions from Excellent down to and including this mention
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
  
  // Calculate GMD's Usual score
  const GMDsScore = calculateUsualScore(judgmentCounts);

  return {
    majorityMention: majorityIteration?.mention || 'Bad',
    majorityPercentage: majorityIteration?.percentage || 0,
    
    GMDsUsualScore: GMDsScore,
    GMDsUsualScoreFormatted: formatGMDsScore(GMDsScore),
    
    iterations,
    
    // Ranking will be computed separately
    rank: 1,
    isWinner: false,
    isExAequo: false,
    
    displaySummary: `${majorityIteration?.mention || 'Bad'} (${(majorityIteration?.percentage || 0).toFixed(1)}%)`,
    comparisonSignature: `${majorityIteration?.mention || 'Bad'}:${(majorityIteration?.percentage || 0).toFixed(1)}`
  };
}

/**
 * Compare two options using GMD's Usual tie-breaking
 */
export function compareMJ(countsA: JudgmentCounts, countsB: JudgmentCounts) {
  const strategy = getStrategy();
  return strategy.compare(countsA, countsB, {
    calculateMedian: (counts: JudgmentCounts) => computeMJAnalysis(counts).majorityMention,
    getMentionValue: (mention: keyof JudgmentCounts) => {
      const values = {
        'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3, 
        'Passable': 2, 'Inadequate': 1, 'Bad': 0
      };
      return values[mention];
    }
  });
}

/**
 * Rank multiple options using majority judgment with GMD's Usual tie-breaking
 */
export function rankOptions<T extends { 
  id: string; 
  label: string; 
  judgment_counts: JudgmentCounts; 
  total_judgments: number; 
}>(options: T[]): (T & { mjAnalysis: MJAnalysis })[] {
  
  // Calculate MJ analysis for each option
  const analyzed = options.map(option => ({
    ...option,
    mjAnalysis: computeMJAnalysis(option.judgment_counts)
  }));

  // Sort using pairwise comparisons with GMD's Usual tie-breaking
  analyzed.sort((a, b) => {
    const comparison = compareMJ(a.judgment_counts, b.judgment_counts);
    if (comparison.winner === 'A') return -1;
    if (comparison.winner === 'B') return 1;
    return 0;
  });

  // Assign ranks and determine ties
  let currentRank = 1;
  for (let i = 0; i < analyzed.length; i++) {
    if (i > 0) {
      const comparison = compareMJ(analyzed[i-1].judgment_counts, analyzed[i].judgment_counts);
      if (comparison.winner !== 'TIE') {
        currentRank = i + 1;
      }
    }
    
    analyzed[i].mjAnalysis.rank = currentRank;
    analyzed[i].mjAnalysis.isWinner = currentRank === 1;
    
    // Check for ties with other options at same rank
    analyzed[i].mjAnalysis.isExAequo = analyzed.some((other, j) => 
      i !== j && other.mjAnalysis.rank === currentRank
    );
  }

  return analyzed;
}

/**
 * Create a display summary for an MJ analysis
 */
export function createDisplaySummary(analysis: MJAnalysis): string {
  return `${analysis.majorityMention} (${analysis.majorityPercentage.toFixed(1)}%) • GMD: ${analysis.GMDsUsualScoreFormatted}`;
}

/**
 * Create a comparison signature for caching/comparison purposes
 */
export function createComparisonSignature(analysis: MJAnalysis): string {
  return `${analysis.majorityMention}:${analysis.majorityPercentage.toFixed(1)}|GMD:${analysis.GMDsUsualScore.toFixed(4)}`;
}
