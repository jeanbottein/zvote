import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInvitation, getPoll, listInvitations, revokeInvitation, watchPoll, type PollWatcher,
} from '../api/client';
import type { Invitation, Poll } from '../api/types';
import { lunchPoll } from '../test/fixtures';
import { renderAt } from '../test/render';
import PollPage from './PollPage';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPoll: vi.fn(),
  watchPoll: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

const mine: Poll = lunchPoll({ isMine: true, invitationOnly: true, resultsShown: 'AFTER_CLOSING' });
const ana: Invitation = { token: 'ana-token', label: 'Ana', used: true };
const nameless: Invitation = { token: 'second-token', label: null, used: false };

let watcher: PollWatcher;

beforeEach(() => {
  vi.mocked(getPoll).mockResolvedValue(mine);
  vi.mocked(watchPoll).mockImplementation((_, w) => {
    watcher = w;
    return () => {};
  });
  vi.mocked(listInvitations).mockResolvedValue([ana, nameless]);
});

async function openInvitations(entry: Parameters<typeof renderAt>[0] = '/p/abc') {
  renderAt(entry, [{ path: '/p/:id', element: <PollPage /> }]);
  const section = (await screen.findByRole('heading', { name: 'Invitations' })).closest('section')!;
  await within(section).findByText('Ana');
  return section;
}

describe("a poll's invitations", () => {
  it('say which were used, never by which ballot', async () => {
    const section = await openInvitations();

    expect(within(section).getByText('1 of 2 used')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem').map((row) => row.textContent))
      .toEqual(['Ana Used', 'Invitation 2Not used yet']);
  });

  it('are offered to the creator right after creating the poll, rather than its link', async () => {
    await openInvitations({ pathname: '/p/abc', state: { created: true } });

    expect(screen.getByText(/Invite people below/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1); // the header's, for the poll's link
  });

  it('come one per person, whose link the creator shares', async () => {
    const user = userEvent.setup();
    const bob = { token: 'bob-token', label: 'Bob', used: false };
    vi.mocked(createInvitation).mockResolvedValue(bob);
    const section = await openInvitations();
    vi.mocked(listInvitations).mockResolvedValue([ana, nameless, bob]);

    await user.type(within(section).getByLabelText('Invite someone'), ' Bob {Enter}');
    expect(createInvitation).toHaveBeenCalledWith('abc', 'Bob');
    await user.click(await within(section).findByRole('button', { name: 'Share the link for Bob' }));

    const dialog = screen.getByRole('dialog', { name: 'Invitation for Bob' });
    expect(within(dialog).getByRole('textbox', { name: 'Link of the invitation' }))
      .toHaveValue(`${window.location.origin}/p/abc#invitation=bob-token`);
    expect(within(section).getByLabelText('Invite someone')).toHaveValue('');
  });

  it('can be anonymous', async () => {
    const third = { token: 'third-token', label: null, used: false };
    vi.mocked(createInvitation).mockResolvedValue(third);
    const section = await openInvitations();
    vi.mocked(listInvitations).mockResolvedValue([ana, nameless, third]);

    await userEvent.click(within(section).getByRole('button', { name: 'Invite' }));

    expect(createInvitation).toHaveBeenCalledWith('abc', null);
    expect(await within(section).findByText('Invitation 3')).toBeInTheDocument();
  });

  it('can be taken back while nobody has voted with them, once the creator confirms', async () => {
    vi.mocked(revokeInvitation).mockResolvedValue();
    const section = await openInvitations();
    expect(within(section).queryByRole('button', { name: 'Take back the link for Ana' })).not.toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Take back the link for Invitation 2' }));
    expect(revokeInvitation).not.toHaveBeenCalled();
    vi.mocked(listInvitations).mockResolvedValue([ana]);
    await userEvent.click(within(section).getByRole('button', { name: 'Take it back' }));

    expect(revokeInvitation).toHaveBeenCalledWith('abc', 'second-token');
    expect(within(section).queryByText('Invitation 2')).not.toBeInTheDocument();
  });

  it('stay when the creator thinks better of it, and the focus where it was', async () => {
    const section = await openInvitations();

    await userEvent.click(within(section).getByRole('button', { name: 'Take back the link for Invitation 2' }));
    await userEvent.click(within(section).getByRole('button', { name: 'Keep it' }));

    expect(revokeInvitation).not.toHaveBeenCalled();
    expect(within(section).getByRole('button', { name: 'Take back the link for Invitation 2' })).toHaveFocus();
  });

  it('are read again as ballots come in', async () => {
    const section = await openInvitations();
    vi.mocked(listInvitations).mockResolvedValue([ana, { ...nameless, used: true }]);

    act(() => watcher.onUpdate({
      closedAt: null, totalBallots: 2, options: mine.options, voterNames: null, moreVoterNames: false,
    }));

    expect(await within(section).findByText('2 of 2 used')).toBeInTheDocument();
  });

  it('stop coming once the poll is closed', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...mine, closedAt: '2026-09-24T11:00:00Z' });
    const section = await openInvitations();

    expect(within(section).queryByLabelText('Invite someone')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /Take back/ })).not.toBeInTheDocument();
  });
});
