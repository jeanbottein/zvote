import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, listMyPolls, listPublicPolls } from '../api/client';
import type { PollSummary } from '../api/types';
import { renderAt } from '../test/render';
import HomePage from './HomePage';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  listMyPolls: vi.fn(),
  listPublicPolls: vi.fn(),
}));

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
    expect(within(section('Your polls')).getByText('Unlisted')).toBeInTheDocument();

    const others = within(section('Public polls')).getAllByRole('link');
    expect(others).toHaveLength(1); // the voter's own public poll is listed once, above
    expect(others[0]).toHaveAttribute('href', '/p/offsite');
    expect(within(others[0]).getByText('Approval voting')).toBeInTheDocument();
    expect(within(others[0]).getByText('Closed')).toBeInTheDocument();
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

  it('leads to creating a poll', () => {
    openHome();

    expect(screen.getByRole('link', { name: 'Create a poll' })).toHaveAttribute('href', '/new');
  });
});
