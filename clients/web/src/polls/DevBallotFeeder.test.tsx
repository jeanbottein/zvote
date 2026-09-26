import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, castBallotAsNewVoter } from '../api/client';
import type { Poll } from '../api/types';
import { ToastProvider } from '../ui/Toasts';
import DevBallotFeeder from './DevBallotFeeder';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  castBallotAsNewVoter: vi.fn(),
}));

const lunch = {
  id: 'abc',
  votingSystem: 'APPROVAL',
  options: [{ id: '1', label: 'Ramen' }, { id: '2', label: 'Tacos' }],
} as Poll;

const feed = async (ballots: number) => {
  render(<ToastProvider><DevBallotFeeder poll={lunch} /></ToastProvider>);
  await userEvent.clear(screen.getByLabelText('Number of random ballots'));
  await userEvent.type(screen.getByLabelText('Number of random ballots'), String(ballots));
  await userEvent.click(screen.getByRole('button', { name: 'Cast random ballots' }));
};

describe('the ballot feeder (development only)', () => {
  it('casts random ballots, each from a new voter', async () => {
    vi.mocked(castBallotAsNewVoter).mockResolvedValue(lunch);

    await feed(3);

    expect(castBallotAsNewVoter).toHaveBeenCalledTimes(3);
    expect(castBallotAsNewVoter).toHaveBeenCalledWith('abc', { approvedOptionIds: expect.any(Array) });
    expect(await screen.findByRole('button', { name: 'Cast random ballots' })).toBeEnabled();
  });

  it('stops at the first refusal, and says why', async () => {
    vi.mocked(castBallotAsNewVoter).mockRejectedValue(new ApiError(409, 'This poll is closed.'));

    await feed(3);

    expect(castBallotAsNewVoter).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('This poll is closed.');
    expect(screen.getByRole('button', { name: 'Cast random ballots' })).toBeEnabled();
  });
});
