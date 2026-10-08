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
  /** The same score as an exact fraction, (above - below) / at, which ranks options without rounding. */
  gmdFraction: { numerator: number; denominator: number };
  rank: number;
  isWinner: boolean;
  isExAequo: boolean;
};

/**
 * The majority mention: the best mention that a majority of the voters - more
 * than half - give the option or better.
 *
 * With an even number of ballots this is the lower of the two middle mentions,
 * as majority judgment defines it (Balinski and Laraki): five Excellent and
 * five Bad make Bad, because only half the voters say Excellent while all of
 * them say Bad or better.
 */
function calculateMedian(counts: JudgmentCounts): keyof JudgmentCounts {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 'Bad';

  const half = total / 2;
  let cumulative = 0;

  for (const mention of mentions) {
    cumulative += counts[mention];
    if (cumulative > half) {
      return mention;
    }
  }

  return 'Bad';
}

/**
 * Calculate GMJ's Usual score: (pc - qc) / rc
 *
 * The proportions share the same denominator, so the score is the fraction of
 * whole counts (above - below) / at, and options are ranked by comparing those
 * fractions exactly. Equal scores stay ex aequo, which dividing proportions
 * broke (0.5000000000000001 vs 0.5), and different scores stay apart, which
 * dividing counts breaks past about 70 million ballots.
 */
function calculateGMJScore(counts: JudgmentCounts): { numerator: number; denominator: number } {
  const mentions: (keyof JudgmentCounts)[] = [
    'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
  ];
  
  const median = calculateMedian(counts);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) return { numerator: 0, denominator: 1 };
  
  const medianIndex = mentions.indexOf(median);
  
  // pc: proportion strictly above median (better mentions)
  let aboveCount = 0;
  for (let i = 0; i < medianIndex; i++) {
    aboveCount += counts[mentions[i]];
  }
  
  // qc: proportion strictly below median (worse mentions)
  let belowCount = 0;
  for (let i = medianIndex + 1; i < mentions.length; i++) {
    belowCount += counts[mentions[i]];
  }
  
  // rc: proportion exactly at median
  const atCount = counts[median];
  
  // When rc = 0, the score is pc - qc: (above - below) / total
  return { numerator: aboveCount - belowCount, denominator: atCount === 0 ? total : atCount };
}

/**
 * Compute majority judgment analysis for a single option
 */
export function computeMJAnalysis(judgmentCounts: JudgmentCounts): MJAnalysis {
  const majorityMention = calculateMedian(judgmentCounts);
  const gmdFraction = calculateGMJScore(judgmentCounts);
  
  return {
    majorityMention,
    gmdScore: gmdFraction.numerator / gmdFraction.denominator,
    gmdFraction,
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
  
  // If same mention, compare by GMJ score (higher is better), as fractions:
  // past about 70 million ballots, two different scores can round to the same number.
  const scoreB = BigInt(analysisB.gmdFraction.numerator) * BigInt(analysisA.gmdFraction.denominator);
  const scoreA = BigInt(analysisA.gmdFraction.numerator) * BigInt(analysisB.gmdFraction.denominator);
  return scoreB === scoreA ? 0 : scoreB > scoreA ? 1 : -1;
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
