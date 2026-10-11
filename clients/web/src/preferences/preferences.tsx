/**
 * The voter's display and ballot preferences, remembered in this browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Preferences {
  /**
   * Light or dark. "system" follows the device, through the CSS color-scheme. Not to be confused with a
   * theme, which is a palette (data-theme, docs/DESIGN.md): there is one so far, so nothing chooses it.
   */
  appearance: 'system' | 'light' | 'dark';
  /** A grey mention ramp that does not rely on telling red from green. */
  colorblind: boolean;
  /** How a majority judgment ballot is filled in: a colour scale per option, or a dropdown per option. */
  mjBallot: 'scale' | 'dropdown';
  /** Live: every change is cast at once. Envelope: changes are reviewed, then submitted together. */
  submission: 'live' | 'envelope';
  /** The name last given on a poll that shows names, offered again on the next one. Empty: anonymous. */
  voterName: string;
}

const DEFAULTS: Preferences = { appearance: 'system', colorblind: false, mjBallot: 'scale', submission: 'live', voterName: '' };
const STORAGE_KEY = 'zvote.preferences'; // index.html reads it too, to set the appearance before the first paint

export function loadPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULTS; // Storage disabled, or unreadable.
  }
}

/** Reflects the preferences on the document, where the stylesheets look for them. */
export function applyPreferences({ appearance, colorblind }: Pick<Preferences, 'appearance' | 'colorblind'>) {
  const root = document.documentElement;
  if (appearance === 'system') {
    delete root.dataset.appearance;
  } else {
    root.dataset.appearance = appearance;
  }
  // The browser's own bars (index.html's theme-color tags) follow a chosen appearance too.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-scheme]')) {
    const scheme = meta.dataset.scheme;
    meta.media = appearance === 'system' ? `(prefers-color-scheme: ${scheme})` : appearance === scheme ? 'all' : 'not all';
  }
  // The grey mention palette (mentions.css) reads this attribute from <body>.
  if (colorblind) {
    document.body.dataset.colorblind = 'true';
  } else {
    delete document.body.dataset.colorblind;
  }
}

type PreferencesValue = [Preferences, (change: Partial<Preferences>) => void];

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    applyPreferences(preferences);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Not remembered across visits; the app works the same.
    }
  }, [preferences]);

  const update = useCallback((change: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...change }));
  }, []);

  const value = useMemo<PreferencesValue>(() => [preferences, update], [preferences, update]);
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences() must be used inside <PreferencesProvider>');
  }
  return value;
}
