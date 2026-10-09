import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShareButton from './ShareButton';

const lunch = {
  id: 'abc', joinCode: 'K7M4QX', title: 'Where do we eat?', visibility: 'UNLISTED' as const, invitationOnly: false,
};
const link = `${window.location.origin}/p/abc`;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openShare(poll = lunch) {
  const user = userEvent.setup();
  render(<ShareButton poll={poll} />);
  await user.click(screen.getByRole('button', { name: 'Share' }));
  return user;
}

describe('sharing a poll', () => {
  it('shows its join code, its link, and a QR code of the link', async () => {
    await openShare();

    expect(screen.getByText('K7M-4QX')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Link to the poll' })).toHaveValue(link);
    expect(screen.getByTitle(`QR code for ${link}`)).toBeInTheDocument();
    expect(screen.getByText(/not listed anywhere else/)).toBeInTheDocument();
  });

  it('selects the link for the person to copy when the clipboard is out of reach', async () => {
    const user = await openShare();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Link to the poll' });
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, link.length]);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it("goes through the device's share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share }));
    await openShare();

    await userEvent.click(screen.getByRole('button', { name: 'Share through an app' }));

    expect(share).toHaveBeenCalledWith({ title: 'Where do we eat?', url: link });
  });

  it('sends it by email', async () => {
    await openShare();

    expect(screen.getByRole('link', { name: 'Send by email' }))
      .toHaveAttribute('href', `mailto:?subject=Where%20do%20we%20eat%3F&body=${encodeURIComponent(link)}`);
  });

  it('says that only invited people can vote on a poll that takes invitations', async () => {
    await openShare({ ...lunch, invitationOnly: true });

    expect(screen.getByText(/Only the people you invite can vote/)).toBeInTheDocument();
  });
});
