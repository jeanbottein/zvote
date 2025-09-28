import type { TieBreakStrategy } from './types';
import jugementMajoritaireVariant from './jugement-majoritaire-variant';
import fabresTypical from './fabre-typical';
import fabresUsual from './fabre-usual';
import fabresCentral from './fabre-central';

const STRATEGY_STORAGE_KEY = 'mj.tieBreakStrategy';

export const strategies: Record<string, TieBreakStrategy> = {
  [jugementMajoritaireVariant.key]: jugementMajoritaireVariant,
  [fabresTypical.key]: fabresTypical,
  [fabresUsual.key]: fabresUsual,
  [fabresCentral.key]: fabresCentral,
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
  return fabresUsual.key;
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
