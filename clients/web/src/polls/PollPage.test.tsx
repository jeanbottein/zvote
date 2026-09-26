import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InitialEntry } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, castBallot, deletePoll, getPoll, setPollClosed, watchPoll, type PollWatcher,
} from '../api/client';
import type { Poll } from '../api/types';
import { renderAt } from '../test/render';
import PollPage from './PollPage';
import { RETRY_DELAY } from './usePoll';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPoll: vi.fn(),
  watchPoll: vi.fn(),
  castBallot: vi.fn(),
  setPollClosed: vi.fn(),
  deletePoll: vi.fn(),
}));

const noJudgments = { Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0 };

const lunch: Poll = {
  id: 'abc',
  title: 'Where do we eat?',
  votingSystem: 'MAJORITY_JUDGMENT',
  visibility: 'PUBLIC',
  createdAt: '2026-09-24T10:00:00Z',
  closedAt: null,
  isMine: false,
  totalBallots: 0,
  options: [
    { id: '1', label: 'Ramen', approvalCount: null, judgmentCounts: noJudgments },
    { id: '2', label: 'Tacos', approvalCount: null, judgmentCounts: noJudgments },
  ],
  myBallot: null,
};

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
      options: [
        { ...lunch.options[0], judgmentCounts: { ...noJudgments, Excellent: 3 } },
        { ...lunch.options[1], judgmentCounts: { ...noJudgments, Bad: 3 } },
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
      myBallot: { approvedOptionIds: null, judgments: { 1: 'Excellent', 2: 'Bad' } },
    });
    openPoll();

    await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(within(scaleOf('Ramen')).getByRole('radio', { name: 'Excellent' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Excellent' } });
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

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Good', 2: 'Fair' } });
  });

  it('lets the voter withdraw their ballot', async () => {
    vi.mocked(getPoll).mockResolvedValue({
      ...lunch,
      totalBallots: 1,
      myBallot: { approvedOptionIds: null, judgments: { 1: 'Good', 2: 'Bad' } },
    });
    vi.mocked(castBallot).mockResolvedValue(lunch);
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: {} });
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

    expect(castBallot).toHaveBeenCalledWith('abc', { approvedOptionIds: ['2'] });
  });
});

describe('managing a poll', () => {
  const mine: Poll = { ...lunch, isMine: true };

  beforeEach(() => {
    vi.mocked(getPoll).mockResolvedValue(mine);
  });

  it('closes voting, and reopens it', async () => {
    vi.mocked(setPollClosed).mockResolvedValueOnce({ ...mine, closedAt: '2026-09-24T11:00:00Z' });
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));

    expect(setPollClosed).toHaveBeenCalledWith('abc', true);
    expect(await screen.findByText(/These are the final results/)).toBeInTheDocument();

    vi.mocked(setPollClosed).mockResolvedValueOnce(mine);
    await userEvent.click(screen.getByRole('button', { name: 'Reopen voting' }));

    expect(setPollClosed).toHaveBeenLastCalledWith('abc', false);
    expect(await screen.findByRole('heading', { name: 'Your ballot' })).toBeInTheDocument();
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
    vi.mocked(setPollClosed).mockRejectedValue(new ApiError(403, "Only the poll's creator can do that."));
    openPoll();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Only the poll's creator can do that.");
    expect(screen.getByRole('button', { name: 'Close voting' })).toBeEnabled();
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
