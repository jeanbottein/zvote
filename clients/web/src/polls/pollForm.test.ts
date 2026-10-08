import { describe, expect, it } from 'vitest';
import { checkPollForm, filledOptions, offeredVotingSystems, optionRows } from './pollForm';

const limits = { maxOptions: 4, maxTitleLength: 10, maxOptionLength: 6, maxVoterNameLength: 40, pollLifetimeDays: 30 };

const form = (title: string, options: string[], resultsAfterBallots?: string) => ({
  title,
  options,
  resultsShown: resultsAfterBallots === undefined ? 'LIVE' as const : 'AFTER_BALLOTS' as const,
  resultsAfterBallots: resultsAfterBallots ?? '',
});

describe('checkPollForm', () => {
  it('accepts a title and two distinct options', () => {
    expect(checkPollForm(form('Lunch?', ['Ramen', 'Tacos']), limits)).toEqual({});
  });

  it('ignores blank rows', () => {
    expect(checkPollForm(form('Lunch?', ['Ramen', ' ', 'Tacos', '']), limits)).toEqual({});
    expect(filledOptions([' Ramen ', '', 'Tacos'])).toEqual(['Ramen', 'Tacos']);
  });

  it.each([
    ['  ', ['Ramen', 'Tacos'], { title: 'Give your poll a title.' }],
    ['Lunch at noon?', ['Ramen', 'Tacos'], { title: 'A title can be at most 10 characters long.' }],
    ['Lunch?', ['Ramen', ''], { options: 'Add at least two options.' }],
    ['Lunch?', ['A', 'B', 'C', 'D', 'E'], { options: 'A poll can have at most 4 options.' }],
    ['Lunch?', ['Ramen', 'Burritos'], { options: 'An option can be at most 6 characters long.' }],
    ['Lunch?', ['Ramen', 'ramen'], { options: '"ramen" is listed twice. Each option must be different.' }],
  ])('explains what is wrong with "%s" and %j', (title, options, problems) => {
    expect(checkPollForm(form(title, options), limits)).toEqual(problems);
  });

  it.each(['', '2', '3.5', '1e30'])('refuses to show the results after "%s" ballots', (ballots) => {
    expect(checkPollForm(form('Lunch?', ['Ramen', 'Tacos'], ballots), limits)).toEqual({
      resultsAfterBallots: 'Choose a whole number of ballots, at least 3.',
    });
  });

  it('shows the results after 3 ballots or more, billions included', () => {
    expect(checkPollForm(form('Lunch?', ['Ramen', 'Tacos'], '3'), limits)).toEqual({});
    expect(checkPollForm(form('Lunch?', ['Ramen', 'Tacos'], '5000000000'), limits)).toEqual({});
  });
});

describe('optionRows', () => {
  it('always shows at least two rows', () => {
    expect(optionRows([], 4)).toEqual(['', '']);
    expect(optionRows(['Ramen'], 4)).toEqual(['Ramen', '']);
  });

  it('offers a blank row for the next option', () => {
    expect(optionRows(['Ramen', 'Tacos'], 4)).toEqual(['Ramen', 'Tacos', '']);
  });

  it('offers no more rows once the poll is full', () => {
    expect(optionRows(['A', 'B', 'C', 'D'], 4)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('does not stack blank rows', () => {
    expect(optionRows(['Ramen', 'Tacos', ''], 4)).toEqual(['Ramen', 'Tacos', '']);
  });
});

describe('offeredVotingSystems', () => {
  it('only offers what the server offers', () => {
    const info = {
      features: { publicPolls: true, unlistedPolls: true, approvalVoting: false, majorityJudgment: true },
      limits,
    };

    expect(offeredVotingSystems(info).map((choice) => choice.value)).toEqual(['MAJORITY_JUDGMENT']);
  });
});
