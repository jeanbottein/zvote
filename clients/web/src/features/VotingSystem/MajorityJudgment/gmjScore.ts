import type { Score } from '../../../api/types';

/** The GMJ score as a number, for showing only: ranking compares the fraction. */
export const gmjScore = (score: Score) => score.numerator / score.denominator;

/** Two decimals, as the results have always shown it. */
export const formatGMJScore = (score: Score) => gmjScore(score).toFixed(2);
