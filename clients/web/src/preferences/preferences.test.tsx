import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPreferences, loadPreferences, PreferencesProvider, usePreferences } from './preferences';

const STORAGE_KEY = 'zvote.preferences';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  applyPreferences(loadPreferences()); // back to the defaults
});

describe('loading the preferences', () => {
  it('starts from the defaults', () => {
    expect(loadPreferences()).toEqual({
      theme: 'system', colorblind: false, mjBallot: 'scale', submission: 'live', voterName: '',
    });
  });

  it('keeps what was saved, and the defaults for the rest', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'dark', submission: 'envelope' }));

    expect(loadPreferences()).toEqual({
      theme: 'dark', colorblind: false, mjBallot: 'scale', submission: 'envelope', voterName: '',
    });
  });

  it('falls back to the defaults when what was saved cannot be read', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(loadPreferences().theme).toBe('system');
  });
});

describe('applying the preferences', () => {
  it('puts the theme on <html> and the grey palette on <body>, where the stylesheets look', () => {
    applyPreferences({ theme: 'dark', colorblind: true });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.body.dataset.colorblind).toBe('true');

    applyPreferences({ theme: 'system', colorblind: false });

    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(document.body).not.toHaveAttribute('data-colorblind');
  });
});

describe("the browser's own bars", () => {
  it('take the colour of a chosen theme, and follow the device otherwise', () => {
    // As in index.html.
    document.head.insertAdjacentHTML('beforeend', `
      <meta name="theme-color" content="#68cc92" media="(prefers-color-scheme: light)" data-scheme="light">
      <meta name="theme-color" content="#124d38" media="(prefers-color-scheme: dark)" data-scheme="dark">`);
    const media = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
      .map((meta) => meta.media);

    applyPreferences({ theme: 'dark', colorblind: false });
    expect(media()).toEqual(['not all', 'all']);

    applyPreferences({ theme: 'light', colorblind: false });
    expect(media()).toEqual(['all', 'not all']);

    applyPreferences({ theme: 'system', colorblind: false });
    expect(media()).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);

    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  });
});

describe('changing a preference', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <PreferencesProvider>{children}</PreferencesProvider>;

  it('applies it, and remembers it for the next visit', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => result.current[1]({ theme: 'light' }));

    expect(result.current[0].theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ theme: 'light', submission: 'live' });
  });

  it('still applies it when this browser cannot remember it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => result.current[1]({ colorblind: true }));

    expect(document.body.dataset.colorblind).toBe('true');
  });

  it('needs the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React reports the error too

    expect(() => renderHook(() => usePreferences())).toThrow('inside <PreferencesProvider>');
  });
});
