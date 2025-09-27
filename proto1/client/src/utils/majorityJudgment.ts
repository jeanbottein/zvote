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
