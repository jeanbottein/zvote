import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InitialEntry } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, castBallot, closePoll, deletePoll, getPoll, watchPoll, type PollWatcher,
} from '../api/client';
import type { Poll } from '../api/types';
import { lunchPoll, NO_JUDGMENTS } from '../test/fixtures';
import { renderAt } from '../test/render';
import PollPage from './PollPage';
import { RETRY_DELAY } from './usePoll';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPoll: vi.fn(),
  watchPoll: vi.fn(),
  castBallot: vi.fn(),
  closePoll: vi.fn(),
  deletePoll: vi.fn(),
}));

const lunch = lunchPoll();

let watcher: PollWatcher;

beforeEach(() => {
  vi.mocked(getPoll).mockResolvedValue(lunch);
  vi.mocked(watchPoll).mockImplementation((_, w) => {
    watcher = w;
    return () => {};
  });
});

afterEach(() => {
  localStorage.clear();
});

const openPoll = (entry: InitialEntry = '/p/abc') => renderAt(entry, [{ path: '/p/:id', element: <PollPage /> }]);

const scaleOf = (option: string) => screen.getByRole('radiogroup', { name: option });

describe('a poll page', () => {
  it('shows the poll, and its results as they change', async () => {
    openPoll();

    expect(await screen.findByRole('heading', { name: 'Where do we eat?' })).toBeInTheDocument();
    expect(screen.getByText('0 ballots')).toBeInTheDocument();

    act(() => watcher.onUpdate({
      closedAt: null,
      totalBallots: 3,
      voterNames: null,
      moreVoterNames: false,
      options: [
        { ...lunch.options[0], judgmentCounts: { ...NO_JUDGMENTS, Excellent: 3 } },
        { ...lunch.options[1], judgmentCounts: { ...NO_JUDGMENTS, Bad: 3 } },
      ],
    }));

    expect(screen.getByText('3 ballots')).toBeInTheDocument();
  });

  it('shows the final results of a closed poll, without a ballot', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...lunch, closedAt: '2026-09-24T11:00:00Z' });
    openPoll();

    expect(await screen.findByText(/These are the final results/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your ballot' })).not.toBeInTheDocument();
  });

  it('gives its creator the link to share it, right after creating it', async () => {
    const user = userEvent.setup();
    vi.mocked(getPoll).mockResolvedValue({ ...lunch, isMine: true });
    openPoll({ pathname: '/p/abc', state: { created: true } });

    expect(await screen.findByText('Your poll is ready.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Share' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Share this poll' });
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/p/abc`);
    expect(within(dialog).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('says so when the poll does not exist', async () => {
    vi.mocked(getPoll).mockRejectedValue(new ApiError(404, 'That poll does not exist.'));
    openPoll();

    expect(await screen.findByRole('heading', { name: 'Poll not found' })).toBeInTheDocument();
  });

  it('says why the poll could not be loaded', async () => {
    vi.mocked(getPoll).mockRejectedValue(new ApiError(0, 'The server cannot be reached.'));
    openPoll();

    expect(await screen.findByRole('heading', { name: 'The poll could not be loaded' })).toBeInTheDocument();
    expect(screen.getByText('The server cannot be reached.')).toBeInTheDocument();
  });

  it('says so when the poll is deleted while it is open', async () => {
    openPoll();
    await screen.findByRole('heading', { name: 'Where do we eat?' });

    act(() => watcher.onDeleted());

    expect(screen.getByRole('heading', { name: 'This poll was deleted' })).toBeInTheDocument();
  });
});

describe('voting', () => {
  it('casts a live ballot as soon as a mention is chosen', async () => {
    vi.mocked(castBallot).mockResolvedValue({
      ...lunch,
      totalBallots: 1,
      myBallot: { approvedOptionIds: null, judgments: { 1: 'Excellent', 2: 'Bad' }, voterName: null },
    });
    openPoll();

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(within(scaleOf('Ramen')).getByRole('radio', { name: 'Excellent' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Excellent' } }, null);
    expect(await screen.findByText(/Your ballot is counted/)).toBeInTheDocument();
  });

  it('tells the voter when their ballot is refused', async () => {
    vi.mocked(castBallot).mockRejectedValue(new ApiError(409, 'This poll is closed and no longer accepts ballots.'));
    openPoll();

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(within(scaleOf('Ramen')).getByRole('radio', { name: 'Good' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This poll is closed');
  });

  it('submits an envelope ballot only once every option is rated', async () => {
    localStorage.setItem('zvote.preferences', JSON.stringify({ submission: 'envelope' }));
    vi.mocked(castBallot).mockResolvedValue(lunch);
    openPoll();

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(within(scaleOf('Ramen')).getByRole('radio', { name: 'Good' }));

    expect(screen.getByRole('button', { name: 'Rate every option to submit' })).toBeDisabled();

    await userEvent.click(within(scaleOf('Tacos')).getByRole('radio', { name: 'Fair' }));
    expect(castBallot).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Submit my ballot' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Good', 2: 'Fair' } }, null);
  });

  it('lets the voter withdraw their ballot', async () => {
    vi.mocked(getPoll).mockResolvedValue({
      ...lunch,
      totalBallots: 1,
      myBallot: { approvedOptionIds: null, judgments: { 1: 'Good', 2: 'Bad' }, voterName: null },
    });
    vi.mocked(castBallot).mockResolvedValue(lunch);
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: {} }, null);
    expect(await screen.findByText('You have not voted yet.')).toBeInTheDocument();
  });

  it('casts the options a voter approves', async () => {
    vi.mocked(getPoll).mockResolvedValue({
      ...lunch,
      votingSystem: 'APPROVAL',
      options: lunch.options.map((option) => ({ ...option, approvalCount: 0, judgmentCounts: null })),
    });
    vi.mocked(castBallot).mockResolvedValue(lunch);
    openPoll();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Tacos' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { approvedOptionIds: ['2'] }, null);
  });
});

describe('managing a poll', () => {
  const mine: Poll = { ...lunch, isMine: true };

  beforeEach(() => {
    vi.mocked(getPoll).mockResolvedValue(mine);
  });

  it('closes voting for good, once the creator confirms', async () => {
    vi.mocked(closePoll).mockResolvedValueOnce({ ...mine, closedAt: '2026-09-24T11:00:00Z' });
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('A closed poll cannot be reopened.');
    expect(closePoll).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close for good' }));

    expect(closePoll).toHaveBeenCalledWith('abc');
    expect(await screen.findByText(/These are the final results/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /voting/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete poll' })).toBeInTheDocument();
  });

  it('keeps voting open when the creator thinks better of it, and the focus where it was', async () => {
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    expect(screen.getByRole('button', { name: 'Keep it open' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it open' }));

    expect(closePoll).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close voting' })).toHaveFocus();
  });

  it('deletes the poll once the creator confirms', async () => {
    vi.mocked(deletePoll).mockResolvedValue();
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete poll' }));
    expect(deletePoll).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete for good' }));

    expect(deletePoll).toHaveBeenCalledWith('abc');
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('The poll was deleted.');
  });

  it('keeps the poll when the creator thinks better of it', async () => {
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete poll' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(deletePoll).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete poll' })).toBeInTheDocument();
  });

  it('says why a change failed', async () => {
    vi.mocked(closePoll).mockRejectedValue(new ApiError(403, "Only the poll's creator can do that."));
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close for good' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Only the poll's creator can do that.");
    expect(screen.getByRole('button', { name: 'Close for good' })).toBeEnabled();
  });
});

describe('a poll page whose live stream is lost', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loseTheStream() {
    openPoll();
    await screen.findByRole('heading', { name: 'Where do we eat?' });
    act(() => {
      watcher.onConnectionChange(false);
      watcher.onLost();
    });
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  }

  it('loads the poll and follows it again a little later', async () => {
    await loseTheStream();
    vi.mocked(getPoll).mockResolvedValue({ ...lunch, totalBallots: 4 });

    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAY));

    expect(screen.getByText('4 ballots')).toBeInTheDocument();
    expect(watchPoll).toHaveBeenCalledTimes(2);
  });

  it('keeps trying while the server cannot be reached', async () => {
    await loseTheStream();
    vi.mocked(getPoll)
      .mockRejectedValueOnce(new ApiError(0, 'The server cannot be reached.'))
      .mockResolvedValue({ ...lunch, totalBallots: 2 });

    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAY));
    expect(watchPoll).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAY));

    expect(screen.getByText('2 ballots')).toBeInTheDocument();
    expect(watchPoll).toHaveBeenCalledTimes(2);
  });

  it('says so when the poll was deleted meanwhile', async () => {
    await loseTheStream();
    vi.mocked(getPoll).mockRejectedValue(new ApiError(404, 'That poll does not exist.'));

    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAY));

    expect(screen.getByRole('heading', { name: 'This poll was deleted' })).toBeInTheDocument();
  });
});

describe('results kept back', () => {
  const hidden: Poll = {
    ...lunch,
    resultsShown: 'AFTER_CLOSING',
    totalBallots: 2,
    options: lunch.options.map((option) => ({ ...option, judgmentCounts: null })),
  };

  it('wait for the closing, while the ballots are counted', async () => {
    vi.mocked(getPoll).mockResolvedValue(hidden);
    openPoll();

    expect(await screen.findByText('The results show once the poll closes.')).toBeInTheDocument();
    expect(screen.getByText('2 ballots')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download the results' })).not.toBeInTheDocument();

    act(() => watcher.onUpdate({
      closedAt: '2026-09-24T11:00:00Z',
      totalBallots: 2,
      voterNames: null,
      moreVoterNames: false,
      options: [
        { ...lunch.options[0], judgmentCounts: { ...NO_JUDGMENTS, Excellent: 2 } },
        { ...lunch.options[1], judgmentCounts: { ...NO_JUDGMENTS, Bad: 2 } },
      ],
    }));

    expect(screen.queryByText('The results show once the poll closes.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the results' })).toBeInTheDocument();
  });

  it('show once enough ballots are in', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...hidden, resultsShown: 'AFTER_BALLOTS', resultsAfterBallots: 3 });
    openPoll();

    expect(await screen.findByText(/The results show once 3 ballots are in/)).toBeInTheDocument();

    act(() => watcher.onUpdate({
      closedAt: null,
      totalBallots: 3,
      voterNames: null,
      moreVoterNames: false,
      options: lunch.options.map((option) => ({ ...option, judgmentCounts: { ...NO_JUDGMENTS, Good: 3 } })),
    }));

    expect(screen.queryByText(/The results show once/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the results' })).toBeInTheDocument();
  });

  it('tell the creator that closing shows them', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...hidden, isMine: true });
    openPoll();

    expect(await screen.findByText('The results show once you close the poll.')).toBeInTheDocument();
  });
});

describe('a counted ballot', () => {
  const voted: Poll = {
    ...lunch,
    votingSystem: 'APPROVAL',
    options: lunch.options.map((option) => ({ ...option, approvalCount: 1, judgmentCounts: null })),
    totalBallots: 1,
    myBallot: { approvedOptionIds: ['2'], judgments: null, voterName: null },
  };

  beforeEach(() => {
    vi.mocked(getPoll).mockResolvedValue(voted);
  });

  it('stays hidden until the voter opens it to change it, and can be hidden again', async () => {
    openPoll();

    expect(await screen.findByText(/It stays hidden here/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Change my ballot' }));
    expect(screen.getByRole('checkbox', { name: 'Tacos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ramen' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Hide my ballot' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change my ballot' })).toHaveFocus();
  });

  it('opens on the choices, not on the name, which would bring up a phone\'s keyboard', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...voted, showVoterNames: true, voterNames: [] });
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Change my ballot' }));

    expect(screen.getByRole('checkbox', { name: 'Ramen' })).toHaveFocus();
  });

  it('cannot be hidden with changes not submitted yet', async () => {
    localStorage.setItem('zvote.preferences', JSON.stringify({ submission: 'envelope' }));
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Change my ballot' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ramen' }));

    expect(screen.queryByRole('button', { name: 'Hide my ballot' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit my ballot' })).toBeEnabled();
  });

  it('opens once withdrawn, to vote again', async () => {
    vi.mocked(castBallot).mockResolvedValue({ ...voted, totalBallots: 0, myBallot: null });
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByText('You have not voted yet.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tacos' })).not.toBeChecked();
  });

  it('stays open while the voter votes', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...voted, totalBallots: 0, myBallot: null });
    vi.mocked(castBallot).mockResolvedValue(voted);
    openPoll();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Tacos' }));

    expect(await screen.findByText(/Your ballot is counted. You can change it/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tacos' })).toBeChecked();
  });
});

describe('names', () => {
  const trip: Poll = {
    ...lunch,
    title: 'Where do we go?',
    votingSystem: 'APPROVAL',
    showVoterNames: true,
    totalBallots: 3,
    voterNames: ['Zoé', 'Sam'],
    options: lunch.options.map((option) => ({ ...option, approvalCount: 0, judgmentCounts: null })),
  };

  it('are not asked for, nor shown, on a poll that hides them', async () => {
    openPoll();

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Who voted' })).not.toBeInTheDocument();
  });

  it('go with the ballot, starting from the name last given', async () => {
    localStorage.setItem('zvote.preferences', JSON.stringify({ voterName: 'Jean' }));
    vi.mocked(getPoll).mockResolvedValue(trip);
    vi.mocked(castBallot).mockResolvedValue(trip);
    openPoll();

    expect(await screen.findByLabelText('Your name')).toHaveValue('Jean');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tacos' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { approvedOptionIds: ['2'], voterName: 'Jean' }, null);
  });

  it('can be left blank, to vote anonymously', async () => {
    localStorage.setItem('zvote.preferences', JSON.stringify({ voterName: 'Jean' }));
    vi.mocked(getPoll).mockResolvedValue(trip);
    vi.mocked(castBallot).mockResolvedValue(trip);
    openPoll();

    await userEvent.clear(await screen.findByLabelText('Your name'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tacos' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { approvedOptionIds: ['2'], voterName: null }, null);
  });

  it('change on a counted ballot once the voter is done typing', async () => {
    vi.mocked(getPoll).mockResolvedValue({
      ...trip,
      myBallot: { approvedOptionIds: ['1'], judgments: null, voterName: 'Sam' },
    });
    vi.mocked(castBallot).mockResolvedValue(trip);
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Change my ballot' }));
    const name = screen.getByLabelText('Your name');
    expect(name).toHaveValue('Sam');
    await userEvent.type(name, 'my{Enter}');

    expect(castBallot).toHaveBeenCalledTimes(1);
    expect(castBallot).toHaveBeenCalledWith('abc', { approvedOptionIds: ['1'], voterName: 'Sammy' }, null);
  });

  it('warn that live results can tell who chose what', async () => {
    vi.mocked(getPoll).mockResolvedValue(trip);
    openPoll();

    expect(await screen.findByText(/people watching may tell who chose what/)).toBeInTheDocument();
  });

  it('are offered again on the next poll once the voter is done typing', async () => {
    vi.mocked(getPoll).mockResolvedValue(trip);
    openPoll();

    const name = await screen.findByLabelText('Your name');
    await userEvent.type(name, 'Zo');
    expect(localStorage.getItem('zvote.preferences') ?? '').not.toContain('Zo');
    await userEvent.type(name, 'é{Enter}');

    expect(JSON.parse(localStorage.getItem('zvote.preferences')!).voterName).toBe('Zoé');
  });

  it('show the first hundred, then how many more voted', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...trip, totalBallots: 1_234_567, moreVoterNames: true });
    openPoll();

    const whoVoted = (await screen.findByRole('heading', { name: 'Who voted' })).closest('section')!;
    expect(within(whoVoted).getByText('and 1,234,565 more voters')).toBeInTheDocument();
    expect(screen.getByText('1,234,567 ballots')).toBeInTheDocument();
  });

  it('show under the results, with those who stayed anonymous', async () => {
    vi.mocked(getPoll).mockResolvedValue(trip);
    openPoll();

    const whoVoted = (await screen.findByRole('heading', { name: 'Who voted' })).closest('section')!;
    expect(within(whoVoted).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Zoé', 'Sam']);
    expect(within(whoVoted).getByText('and 1 anonymous voter')).toBeInTheDocument();

    act(() => watcher.onUpdate({
      closedAt: null, totalBallots: 4, options: trip.options, voterNames: ['Zoé', 'Sam', 'Ana'], moreVoterNames: false,
    }));

    expect(within(whoVoted).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('a poll only invited people may vote on', () => {
  const invitational: Poll = { ...lunch, invitationOnly: true, resultsShown: 'AFTER_CLOSING' };

  it('takes the invitation from the link, and votes with it', async () => {
    vi.mocked(getPoll).mockResolvedValue(invitational);
    vi.mocked(castBallot).mockResolvedValue(invitational);
    openPoll('/p/abc#invitation=t0k3n');

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    expect(getPoll).toHaveBeenCalledWith('abc', 't0k3n');
    expect(screen.getByText(/Your invitation holds one ballot/)).toBeInTheDocument();
    await userEvent.click(within(scaleOf('Ramen')).getByRole('radio', { name: 'Good' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Good' } }, 't0k3n');
  });

  it('tells whoever came without an invitation that they cannot vote', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...invitational, admission: 'NOT_INVITED' });
    openPoll();

    expect(await screen.findByText(/^Only invited people can vote on this poll/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your ballot' })).not.toBeInTheDocument();
  });

  it('says when the link is not a valid invitation', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...invitational, admission: 'NOT_INVITED' });
    openPoll('/p/abc#invitation=made-up');

    expect(await screen.findByText(/^This invitation link is not valid/)).toBeInTheDocument();
  });

  it('says when the invitation was used in another browser', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...invitational, admission: 'INVITATION_USED' });
    openPoll('/p/abc#invitation=t0k3n');

    expect(await screen.findByText(/^This invitation was already used/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your ballot' })).not.toBeInTheDocument();
  });
});
