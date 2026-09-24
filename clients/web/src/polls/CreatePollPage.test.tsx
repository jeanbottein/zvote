import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createPoll, getServerInfo } from '../api/client';
import type { Poll } from '../api/types';
import { renderAt } from '../test/render';
import CreatePollPage from './CreatePollPage';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  createPoll: vi.fn(),
  getServerInfo: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getServerInfo).mockResolvedValue({
    features: { publicPolls: true, unlistedPolls: true, approvalVoting: true, majorityJudgment: true },
    limits: { maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100 },
  });
});

const openForm = () => renderAt('/new', [{ path: '/new', element: <CreatePollPage /> }]);

describe('creating a poll', () => {
  it('sends the poll and opens it', async () => {
    vi.mocked(createPoll).mockResolvedValue({ id: 'fresh' } as Poll);
    openForm();

    await userEvent.type(screen.getByLabelText('Question'), 'Where do we eat?');
    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');
    await userEvent.click(screen.getByRole('radio', { name: 'Approval' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Unlisted' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(createPoll).toHaveBeenCalledWith({
      title: 'Where do we eat?',
      options: ['Ramen', 'Tacos'],
      votingSystem: 'APPROVAL',
      visibility: 'UNLISTED',
    });
    expect(await screen.findByText('Poll page fresh')).toBeInTheDocument();
  });

  it('adds a row for the next option as the last one is filled in', async () => {
    openForm();

    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');

    expect(screen.getByLabelText('Option 3')).toHaveValue('');
  });

  it('explains what is missing rather than sending it', async () => {
    openForm();

    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(screen.getByText('Give your poll a title.')).toBeInTheDocument();
    expect(screen.getByText('Add at least two options.')).toBeInTheDocument();
    expect(createPoll).not.toHaveBeenCalled();
  });

  it('shows why the server refused the poll', async () => {
    vi.mocked(createPoll).mockRejectedValue(new ApiError(400, 'Choose a voting system this server offers.'));
    openForm();

    await userEvent.type(screen.getByLabelText('Question'), 'Lunch?');
    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a voting system this server offers.');
  });
});
