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
    limits: { maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100, maxVoterNameLength: 40, pollLifetimeDays: 30 },
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
    await userEvent.click(screen.getByRole('radio', { name: 'Private' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Show names' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(createPoll).toHaveBeenCalledWith({
      title: 'Where do we eat?',
      options: ['Ramen', 'Tacos'],
      votingSystem: 'APPROVAL',
      visibility: 'UNLISTED',
      showVoterNames: true,
      resultsShown: 'AFTER_CLOSING',
      resultsAfterBallots: null,
    });
    expect(await screen.findByText('Poll page fresh')).toBeInTheDocument();
  });

  it('keeps the results of a poll showing names for when it closes, unless told otherwise', async () => {
    openForm();

    expect(await screen.findByRole('radio', { name: 'Live' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Show names' }));
    expect(screen.getByRole('radio', { name: 'At close' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Live' }));
    expect(screen.getByText(/along with the voter's name/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Anonymous' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Show names' }));
    expect(screen.getByRole('radio', { name: 'Live' })).toBeChecked();
  });

  it('warns the creator about live results', async () => {
    openForm();

    expect(await screen.findByText(/In a small group, that shows who chose what/)).toHaveAttribute('data-tone', 'warning');
    await userEvent.click(screen.getByRole('radio', { name: 'At close' }));
    expect(screen.getByText(/Results show once you close the poll/)).not.toHaveAttribute('data-tone');
  });

  it('shows the results after a number of ballots, at least three', async () => {
    vi.mocked(createPoll).mockResolvedValue({ id: 'fresh' } as Poll);
    openForm();
    await userEvent.type(await screen.findByLabelText('Question'), 'Lunch?');
    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');

    await userEvent.click(screen.getByRole('radio', { name: 'Delayed' }));
    const ballots = screen.getByLabelText('Ballots before the results show');
    expect(ballots).toHaveValue(5);
    await userEvent.clear(ballots);
    await userEvent.type(ballots, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(screen.getByText('Choose at least 3 ballots.')).toBeInTheDocument();
    expect(createPoll).not.toHaveBeenCalled();

    await userEvent.clear(ballots);
    await userEvent.type(ballots, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));

    expect(createPoll).toHaveBeenCalledWith(expect.objectContaining({
      resultsShown: 'AFTER_BALLOTS',
      resultsAfterBallots: 4,
    }));
  });

  it('adds a row for the next option as the last one is filled in', async () => {
    openForm();

    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');

    expect(screen.getByLabelText('Option 3')).toHaveValue('');
  });

  it('moves to the next row on Enter rather than sending a half-written poll', async () => {
    openForm();

    await userEvent.type(screen.getByLabelText('Question'), 'Lunch?{Enter}');
    expect(screen.getByLabelText('Option 1')).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen{Enter}');

    expect(screen.getByLabelText('Option 2')).toHaveFocus();
    expect(createPoll).not.toHaveBeenCalled();
  });

  it('removes an option', async () => {
    openForm();

    await userEvent.type(screen.getByLabelText('Option 1'), 'Ramen');
    await userEvent.type(screen.getByLabelText('Option 2'), 'Tacos');
    await userEvent.type(screen.getByLabelText('Option 3'), 'Pizza');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Tacos' }));

    const rows = screen.getAllByRole('textbox', { name: /^Option/ });
    expect(rows.map((row) => (row as HTMLInputElement).value)).toEqual(['Ramen', 'Pizza', '']);
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
