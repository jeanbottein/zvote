/**
 * Graduated Majority Judgment (GMJ)
 * 
 * Calculates majority mention (median) and GMJ's Usual score for ranking.
 * No complex iterations or settling mentions - just the essentials.
 */

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
  gmdScore: number;
  rank: number;
  isWinner: boolean;
  isExAequo: boolean;
};

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
 * Calculate GMJ's Usual score: (pc - qc) / rc
 */
function calculateGMJScore(counts: JudgmentCounts): number {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  const median = calculateMedian(counts);
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
    return pc - qc;
  }
  
  return (pc - qc) / rc;
}

/**
 * Compute majority judgment analysis for a single option
 */
export function computeMJAnalysis(judgmentCounts: JudgmentCounts): MJAnalysis {
  const majorityMention = calculateMedian(judgmentCounts);
  const gmdScore = calculateGMJScore(judgmentCounts);
  
  return {
    majorityMention,
    gmdScore,
    rank: 1, // Will be set during ranking
    isWinner: false, // Will be set during ranking
    isExAequo: false // Will be set during ranking
  };
}

/**
 * Compare two options using majority mention first, then GMJ score
 */
function compareMJ(analysisA: MJAnalysis, analysisB: MJAnalysis): number {
  const mentionValues = {
    'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3, 
    'Passable': 2, 'Inadequate': 1, 'Bad': 0
  };
  
  const valueA = mentionValues[analysisA.majorityMention];
  const valueB = mentionValues[analysisB.majorityMention];
  
  // First compare by majority mention (higher is better)
  if (valueA !== valueB) {
    return valueB - valueA; // Higher mention wins
  }
  
  // If same mention, compare by GMJ score (higher is better)
  return analysisB.gmdScore - analysisA.gmdScore;
}

/**
 * Rank multiple options using majority judgment with GMJ's Usual tie-breaking
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

  // Sort by majority mention first, then by GMJ score
  analyzed.sort((a, b) => compareMJ(a.mjAnalysis, b.mjAnalysis));

  // Assign ranks and determine ties
  let currentRank = 1;
  for (let i = 0; i < analyzed.length; i++) {
    if (i > 0) {
      const comparison = compareMJ(analyzed[i-1].mjAnalysis, analyzed[i].mjAnalysis);
      if (comparison !== 0) {
        currentRank = i + 1;
      }
    }
    
    analyzed[i].mjAnalysis.rank = currentRank;
    analyzed[i].mjAnalysis.isWinner = currentRank === 1;
  }

  // Determine ex aequo status after all ranks are assigned
  for (let i = 0; i < analyzed.length; i++) {
    const currentOptionRank = analyzed[i].mjAnalysis.rank;
    analyzed[i].mjAnalysis.isExAequo = analyzed.some((other, j) => 
      i !== j && other.mjAnalysis.rank === currentOptionRank
    );
  }

  return analyzed;
}

/**
 * Format GMJ score for display
 */
export function formatGMJScore(score: number): string {
  if (score === Number.POSITIVE_INFINITY) return '∞';
  if (score === Number.NEGATIVE_INFINITY) return '-∞';
  return score.toFixed(2);
}

/**
 * Create a display summary for an MJ analysis
 */
export function createDisplaySummary(analysis: MJAnalysis): string {
  return `${analysis.majorityMention} • GMJ: ${formatGMJScore(analysis.gmdScore)}`;
}
