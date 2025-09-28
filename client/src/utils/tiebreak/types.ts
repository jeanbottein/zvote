// Tie-break strategy types (kept independent to avoid runtime cycles)

export type JudgmentCounts = {
  Bad: number;
  Inadequate: number;
  Passable: number;
  Fair: number;
  Good: number;
  VeryGood: number;
  Excellent: number;
};

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
  finalResult: string;
};

export type StrategyDeps = {
  calculateMedian: (counts: JudgmentCounts) => keyof JudgmentCounts;
  getMentionValue: (mention: keyof JudgmentCounts) => number;
};

export type TieBreakStrategy = {
  key: string;
  label: string;
  description: string;
  compare: (
    a: JudgmentCounts,
    b: JudgmentCounts,
    deps: StrategyDeps
  ) => MJComparison;
};
