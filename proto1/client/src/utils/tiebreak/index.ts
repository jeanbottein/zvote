import type { TieBreakStrategy } from './types';
import jeanbottein from './mj-tiebreak-jeanbottein';
import majorityGauge from './mj-majority-gauge';

const STRATEGY_STORAGE_KEY = 'mj.tieBreakStrategy';

export const strategies: Record<string, TieBreakStrategy> = {
  [jeanbottein.key]: jeanbottein,
  [majorityGauge.key]: majorityGauge,
  // Future: add canonical MJ ballot-removal and Highest Median variants here
};

export type StrategyKey = keyof typeof strategies;

export function getAvailableStrategies(): TieBreakStrategy[] {
  return Object.values(strategies);
}

export function getActiveStrategyKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const k = localStorage.getItem(STRATEGY_STORAGE_KEY);
      if (k && strategies[k]) return k;
    }
  } catch {}
  return jeanbottein.key;
}

export function setActiveStrategyKey(key: string) {
  if (!strategies[key]) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STRATEGY_STORAGE_KEY, key);
    }
  } catch {}
}

export function getStrategyByKey(key?: string): TieBreakStrategy {
  if (key && strategies[key]) return strategies[key];
  return strategies[getActiveStrategyKey()];
}
