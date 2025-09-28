import type { TieBreakStrategy } from './types';
import GMDsUsual from './graduated-majority-judgment';

export const strategies: Record<string, TieBreakStrategy> = {
  [GMDsUsual.key]: GMDsUsual,
};

export function getStrategy(): TieBreakStrategy {
  return GMDsUsual;
}
