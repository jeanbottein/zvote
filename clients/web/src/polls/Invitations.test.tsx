import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInvitations, getPoll, listInvitations, revokeInvitation, watchPoll, type PollWatcher,
} from '../api/client';
import type { Invitation, InvitationPage, Poll } from '../api/types';
import { lunchPoll } from '../test/fixtures';
import { renderAt } from '../test/render';
import PollPage from './PollPage';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPoll: vi.fn(),
  watchPoll: vi.fn(),
  listInvitations: vi.fn(),
  createInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
}));

const mine: Poll = lunchPoll({ isMine: true, invitationOnly: true, resultsShown: 'AFTER_CLOSING' });
const ana: Invitation = { number: 1, token: '1.ana', link: null, label: 'Ana', used: true };
const second: Invitation = { number: 2, token: '2.second', link: null, label: null, used: false };

/** The newest first, as the server sends them. */
const pageOf = (invitations: Invitation[], next: number | null = null): InvitationPage => ({
  count: invitations.length, invitations: [...invitations].reverse(), next,
});

let watcher: PollWatcher;

beforeEach(() => {
  vi.mocked(getPoll).mockResolvedValue(mine);
  vi.mocked(watchPoll).mockImplementation((_, w) => {
    watcher = w;
    return () => {};
  });
  vi.mocked(listInvitations).mockResolvedValue(pageOf([ana, second]));
});

async function openInvitations(entry: Parameters<typeof renderAt>[0] = '/p/abc') {
  renderAt(entry, [{ path: '/p/:id', element: <PollPage /> }]);
  const section = (await screen.findByRole('heading', { name: 'Invitations' })).closest('section')!;
  await within(section).findByText('Ana');
  return section;
}

describe("a poll's invitations", () => {
  it('come newest first, and say which were used, never by which ballot', async () => {
    const section = await openInvitations();

    expect(within(section).getByText('1 of 2 used')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem').map((row) => row.textContent))
      .toEqual(['Invitation 2Not used yet', 'Ana Used']);
  });

  it('are offered to the creator right after creating the poll, rather than its link', async () => {
    await openInvitations({ pathname: '/p/abc', state: { created: true } });

    expect(screen.getByText(/Invite people below/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1); // the header's, for the poll's link
  });

  it('come one per person, whose link the creator shares', async () => {
    const user = userEvent.setup();
    const bob = { number: 3, token: '3.bob', link: null, label: 'Bob', used: false };
    vi.mocked(createInvitations).mockResolvedValue(pageOf([ana, second, bob]));
    const section = await openInvitations();
    vi.mocked(listInvitations).mockResolvedValue(pageOf([ana, second, bob]));

    await user.type(within(section).getByLabelText('Invite someone'), ' Bob {Enter}');
    expect(createInvitations).toHaveBeenCalledWith('abc', { labels: ['Bob'] });
    await user.click(await within(section).findByRole('button', { name: 'Share the link for Bob' }));

    const dialog = screen.getByRole('dialog', { name: 'Invitation for Bob' });
    expect(within(dialog).getByRole('textbox', { name: 'Link of the invitation' }))
      .toHaveValue(`${window.location.origin}/p/abc#invitation=3.bob`);
    expect(within(section).getByLabelText('Invite someone')).toHaveValue('');
  });

  it('can be anonymous, known by their number', async () => {
    const third = { number: 3, token: '3.third', link: null, label: null, used: false };
    vi.mocked(createInvitations).mockResolvedValue(pageOf([ana, second, third]));
    const section = await openInvitations();
    vi.mocked(listInvitations).mockResolvedValue(pageOf([ana, second, third]));

    await userEvent.click(within(section).getByRole('button', { name: 'Invite' }));

    expect(createInvitations).toHaveBeenCalledWith('abc', { count: 1 });
    expect(await within(section).findByText('Invitation 3')).toBeInTheDocument();
  });

  it('can be taken back while nobody has voted with them, once the creator confirms', async () => {
    vi.mocked(revokeInvitation).mockResolvedValue();
    const section = await openInvitations();
    expect(within(section).queryByRole('button', { name: 'Take back the link for Ana' })).not.toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Take back the link for Invitation 2' }));
    expect(revokeInvitation).not.toHaveBeenCalled();
    vi.mocked(listInvitations).mockResolvedValue(pageOf([ana]));
    await userEvent.click(within(section).getByRole('button', { name: 'Take it back' }));

    expect(revokeInvitation).toHaveBeenCalledWith('abc', 2);
    expect(await within(section).findByText('1 of 1 used')).toBeInTheDocument();
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
    vi.mocked(listInvitations).mockResolvedValue(pageOf([ana, { ...second, used: true }]));

    act(() => watcher.onUpdate({
      closedAt: null, totalBallots: 2, options: mine.options, voterNames: null, moreVoterNames: false,
    }));

    expect(await within(section).findByText('2 of 2 used')).toBeInTheDocument();
  });

  it('show a hundred at a time, then more on demand', async () => {
    vi.mocked(listInvitations).mockResolvedValue({ count: 250, invitations: [ana, second], next: 151 });
    const section = await openInvitations();
    expect(listInvitations).toHaveBeenLastCalledWith('abc', 100);
    expect(within(section).getByText('250 invitations')).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Show more' }));

    expect(listInvitations).toHaveBeenLastCalledWith('abc', 200);
  });

  it('stop coming once the poll is closed', async () => {
    vi.mocked(getPoll).mockResolvedValue({ ...mine, closedAt: '2026-09-24T11:00:00Z' });
    const section = await openInvitations();

    expect(within(section).queryByLabelText('Invite someone')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /Take back/ })).not.toBeInTheDocument();
  });
});
