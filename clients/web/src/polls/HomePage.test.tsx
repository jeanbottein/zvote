import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ApiError, joinPoll, listMyPolls, listPublicPolls } from '../api/client';
import type { PollSummary, ServerInfo } from '../api/types';
import { renderAt } from '../test/render';
import HomePage from './HomePage';
import { useServerInfo } from './useServerInfo';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  listMyPolls: vi.fn(),
  listPublicPolls: vi.fn(),
  joinPoll: vi.fn(),
}));

vi.mock('./useServerInfo', () => ({ useServerInfo: vi.fn() }));

const offering = (publicPolls: boolean): ServerInfo => ({
  features: { publicPolls, unlistedPolls: true, approvalVoting: true, majorityJudgment: true },
  limits: { maxOptions: 20, maxTitleLength: 200, maxOptionLength: 100, maxVoterNameLength: 40, pollLifetimeDays: 30 },
});

const summary = (id: string, title: string, changes: Partial<PollSummary> = {}): PollSummary => ({
  id,
  title,
  votingSystem: 'MAJORITY_JUDGMENT',
  visibility: 'PUBLIC',
  createdAt: new Date().toISOString(),
  closedAt: null,
  isMine: false,
  ...changes,
});

const lunch = summary('lunch', 'Where do we eat?', { isMine: true, visibility: 'UNLISTED' });
const offsite = summary('offsite', 'Where is the offsite?', { votingSystem: 'APPROVAL', closedAt: new Date().toISOString() });

beforeEach(() => {
  vi.mocked(useServerInfo).mockReturnValue(offering(true));
  vi.mocked(listMyPolls).mockResolvedValue([lunch]);
  vi.mocked(listPublicPolls).mockResolvedValue([offsite, { ...lunch, visibility: 'PUBLIC' }]);
});

const openHome = () => renderAt('/', [{ path: '/', element: <HomePage /> }]);

const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!;

describe('the home page', () => {
  it("lists the voter's polls, then other people's public polls", async () => {
    openHome();

    const mine = await screen.findByRole('link', { name: /Where do we eat\?/ });
    expect(mine).toHaveAttribute('href', '/p/lunch');
    expect(within(section('Your polls')).queryByText('Public')).not.toBeInTheDocument();

    const others = within(section('Public polls')).getAllByRole('link');
    expect(others).toHaveLength(1); // the voter's own public poll is listed once, above
    expect(others[0]).toHaveAttribute('href', '/p/offsite');
    expect(within(others[0]).getByText('Approval voting')).toBeInTheDocument();
    expect(within(others[0]).getByText('Closed')).toBeInTheDocument();
  });

  it('lists no public polls when the server does not offer them', async () => {
    vi.mocked(useServerInfo).mockReturnValue(offering(false));
    openHome();

    await screen.findByRole('link', { name: /Where do we eat\?/ });
    expect(screen.queryByRole('heading', { name: 'Public polls' })).not.toBeInTheDocument();
  });

  it('says what will appear when there is nothing yet', async () => {
    vi.mocked(listMyPolls).mockResolvedValue([]);
    vi.mocked(listPublicPolls).mockResolvedValue([]);
    openHome();

    expect(await screen.findByText('Polls you create will appear here.')).toBeInTheDocument();
    expect(screen.getByText('No public polls yet.')).toBeInTheDocument();
  });

  it('says why the polls could not be listed', async () => {
    vi.mocked(listPublicPolls).mockRejectedValue(new ApiError(0, 'The server cannot be reached.'));
    openHome();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server cannot be reached.');
  });

  it('opens the poll behind a join code', async () => {
    vi.mocked(joinPoll).mockResolvedValue(lunch);
    openHome();

    await userEvent.type(screen.getByLabelText('Got a code?'), 'k7m-4qx');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(joinPoll).toHaveBeenCalledWith('K7M-4QX');
    expect(await screen.findByText('Poll page lunch')).toBeInTheDocument();
  });

  it('says when no poll has the code', async () => {
    vi.mocked(joinPoll).mockRejectedValue(new ApiError(404, 'No poll has this code.'));
    openHome();

    await userEvent.type(screen.getByLabelText('Got a code?'), 'AAAAAA{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('No poll has this code.');
    expect(screen.getByLabelText('Got a code?')).toHaveAttribute('aria-invalid', 'true');
  });

  it('leads to creating a poll', () => {
    openHome();

    expect(screen.getByRole('link', { name: 'Create a poll' })).toHaveAttribute('href', '/new');
  });
});
