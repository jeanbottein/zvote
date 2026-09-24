import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, castBallot, getPoll, watchPoll, type PollWatcher } from '../api/client';
import type { Poll } from '../api/types';
import { renderAt } from '../test/render';
import PollPage from './PollPage';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPoll: vi.fn(),
  watchPoll: vi.fn(),
  castBallot: vi.fn(),
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

const openPoll = () => renderAt('/p/abc', [{ path: '/p/:id', element: <PollPage /> }]);

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

  it('casts a live ballot as soon as a mention is chosen', async () => {
    vi.mocked(castBallot).mockResolvedValue({
      ...lunch,
      totalBallots: 1,
      myBallot: { approvedOptionIds: null, judgments: { 1: 'Excellent', 2: 'Bad' } },
    });
    openPoll();

    const ramen = await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(ramen.querySelector('input[value="Excellent"]')!);

    expect(castBallot).toHaveBeenCalledWith('abc', { judgments: { 1: 'Excellent' } });
    expect(await screen.findByText(/Your ballot is counted/)).toBeInTheDocument();
  });

  it('tells the voter when their ballot is refused', async () => {
    vi.mocked(castBallot).mockRejectedValue(new ApiError(409, 'This poll is closed and no longer accepts ballots.'));
    openPoll();

    const ramen = await screen.findByRole('radiogroup', { name: 'Ramen' });
    await userEvent.click(ramen.querySelector('input[value="Good"]')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('This poll is closed');
  });

  it('shows the final results of a closed poll, without a ballot', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...lunch, closedAt: '2026-09-24T11:00:00Z' });
    openPoll();

    expect(await screen.findByText(/These are the final results/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your ballot' })).not.toBeInTheDocument();
  });

  it('offers its creator to close or delete it', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...lunch, isMine: true });
    openPoll();

    expect(await screen.findByRole('button', { name: 'Close voting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete poll' })).toBeInTheDocument();
  });

  it('says so when the poll does not exist', async () => {
    vi.mocked(getPoll).mockRejectedValue(new ApiError(404, 'That poll does not exist.'));
    openPoll();

    expect(await screen.findByRole('heading', { name: 'Poll not found' })).toBeInTheDocument();
  });

  it('says so when the poll is deleted while it is open', async () => {
    openPoll();
    await screen.findByRole('heading', { name: 'Where do we eat?' });

    act(() => watcher.onDeleted());

    expect(screen.getByRole('heading', { name: 'This poll was deleted' })).toBeInTheDocument();
  });
});
