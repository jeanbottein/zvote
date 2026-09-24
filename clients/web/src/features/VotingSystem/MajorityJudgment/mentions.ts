import type { Mention } from '../../../api/types';

/** Best first: the order in which the ballots and the results graph show them. */
export const MENTIONS_BEST_FIRST: Mention[] = [
  'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad',
];

/** Spelled as MajorityJudgmentResultsGraph spells them. */
export const MENTION_NAMES: Record<Mention, string> = {
  Excellent: 'Excellent',
  VeryGood: 'Very Good',
  Good: 'Good',
  Fair: 'Fair',
  Passable: 'Passable',
  Inadequate: 'Inadequate',
  Bad: 'Bad',
};
