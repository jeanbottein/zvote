import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShareButton from './ShareButton';

const lunch = { id: 'abc', title: 'Where do we eat?', visibility: 'UNLISTED' as const };
const link = `${window.location.origin}/p/abc`;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openShare() {
  const user = userEvent.setup();
  render(<ShareButton poll={lunch} />);
  await user.click(screen.getByRole('button', { name: 'Share' }));
  return user;
}

describe('sharing a poll', () => {
  it('shows its link, and a QR code of it', async () => {
    await openShare();

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
});
