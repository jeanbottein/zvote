import type { ResultsShown, ServerInfo, Visibility, VotingSystem } from '../api/types';

type Limits = ServerInfo['limits'];

/** Fewer ballots than this, and the results are the ballots: two voters would each read the other's. */
export const MIN_RESULTS_AFTER_BALLOTS = 3;

export interface PollForm {
  title: string;
  options: string[];
  resultsShown: ResultsShown;
  /** As typed: AFTER_BALLOTS only. */
  resultsAfterBallots: string;
}

export interface PollFormProblems {
  title?: string;
  options?: string;
  resultsAfterBallots?: string;
}

/** The options that were filled in, trimmed. Blank rows are just ignored. */
export function filledOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter((option) => option !== '');
}

/** The same rules the server applies, checked before sending so mistakes show at once. */
export function checkPollForm(
  { title, options, resultsShown, resultsAfterBallots }: PollForm, limits: Limits,
): PollFormProblems {
  const problems: PollFormProblems = {};

  const trimmedTitle = title.trim();
  if (trimmedTitle === '') {
    problems.title = 'Give your poll a title.';
  } else if (trimmedTitle.length > limits.maxTitleLength) {
    problems.title = `A title can be at most ${limits.maxTitleLength} characters long.`;
  }

  const labels = filledOptions(options);
  const seen = new Set<string>();
  const repeated = labels.find((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
    return false;
  });
  if (labels.length < 2) {
    problems.options = 'Add at least two options.';
  } else if (labels.length > limits.maxOptions) {
    problems.options = `A poll can have at most ${limits.maxOptions} options.`;
  } else if (labels.some((label) => label.length > limits.maxOptionLength)) {
    problems.options = `An option can be at most ${limits.maxOptionLength} characters long.`;
  } else if (repeated) {
    problems.options = `"${repeated}" is listed twice. Each option must be different.`;
  }

  const ballots = Number(resultsAfterBallots);
  if (resultsShown === 'AFTER_BALLOTS' && (resultsAfterBallots.trim() === '' || !Number.isSafeInteger(ballots)
    || ballots < MIN_RESULTS_AFTER_BALLOTS)) {
    problems.resultsAfterBallots = `Choose a whole number of ballots, at least ${MIN_RESULTS_AFTER_BALLOTS}.`;
  }

  return problems;
}

/**
 * The rows the form shows: the options typed so far, a blank row to type the
 * next one into (while there is room), and never fewer than two.
 */
export function optionRows(options: string[], maxOptions: number): string[] {
  const rows = [...options];
  const lastIsFilled = rows.length === 0 || rows[rows.length - 1].trim() !== '';
  if (lastIsFilled && rows.length < maxOptions) {
    rows.push('');
  }
  while (rows.length < 2) {
    rows.push('');
  }
  return rows;
}

export function offeredVotingSystems(info: ServerInfo): { value: VotingSystem; label: string }[] {
  return [
    info.features.majorityJudgment && { value: 'MAJORITY_JUDGMENT' as const, label: 'Majority judgment' },
    info.features.approvalVoting && { value: 'APPROVAL' as const, label: 'Approval' },
  ].filter((choice) => choice !== false);
}

export function offeredVisibilities(info: ServerInfo): { value: Visibility; label: string }[] {
  return [
    info.features.publicPolls && { value: 'PUBLIC' as const, label: 'Public' },
    info.features.unlistedPolls && { value: 'UNLISTED' as const, label: 'Private' },
  ].filter((choice) => choice !== false);
}
