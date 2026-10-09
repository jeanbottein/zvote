import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerInfo, listMyPolls, listPublicPolls } from '../api/client';
import { applyPreferences, loadPreferences } from '../preferences/preferences';
import App from './App';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  listMyPolls: vi.fn(),
  listPublicPolls: vi.fn(),
  getServerInfo: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(listMyPolls).mockResolvedValue([]);
  vi.mocked(listPublicPolls).mockResolvedValue([]);
  vi.mocked(getServerInfo).mockReturnValue(new Promise(() => {})); // the form keeps its assumptions
});

afterEach(() => {
  localStorage.clear();
  applyPreferences(loadPreferences());
  window.history.pushState({}, '', '/');
});

function openAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}

describe('the app', () => {
  it('opens on the home page, with no way back from there', async () => {
    openAt('/');

    expect(await screen.findByText('Polls you create will appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('leads back home from anywhere else', async () => {
    openAt('/new');

    expect(screen.getByRole('heading', { name: 'New poll' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Home' }));

    expect(await screen.findByRole('heading', { name: 'Decide together, fairly.' })).toBeInTheDocument();
  });

  it('says how results are decided, and cites the research, from every page', async () => {
    openAt('/new');

    await userEvent.click(screen.getByRole('link', { name: 'About and the science behind it' }));

    expect(await screen.findByRole('heading', { name: 'About zvote' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A theory of measuring, electing, and ranking' }))
      .toHaveAttribute('href', 'https://doi.org/10.1073/pnas.0702634104');
    expect(screen.getAllByRole('link', { name: /source code/i })[0])
      .toHaveAttribute('href', 'https://github.com/jeanbottein/zvote');
  });

  it('says when there is nothing at an address', () => {
    openAt('/nowhere');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/');
  });
});

describe('the settings', () => {
  it('change how the app looks and votes, at once', async () => {
    openAt('/');

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    await userEvent.click(within(settings).getByRole('radio', { name: 'Dark' }));
    await userEvent.click(within(settings).getByRole('radio', { name: 'Shades of grey' }));
    await userEvent.click(within(settings).getByRole('radio', { name: 'Envelope' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.body.dataset.colorblind).toBe('true');
    expect(within(settings).getByText('Fill in your ballot, then submit it in one go.')).toBeInTheDocument();
    expect(loadPreferences()).toMatchObject({ theme: 'dark', colorblind: true, submission: 'envelope' });
  });

  it('close with their button, and with a tap beside them', async () => {
    openAt('/');

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    fireEvent.click(within(settings).getByRole('group', { name: 'Appearance' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument(); // a tap inside keeps them
    fireEvent.click(settings); // the backdrop is part of the dialog element itself

    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
