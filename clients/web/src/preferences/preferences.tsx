/**
 * The voter's display and ballot preferences, remembered in this browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Preferences {
  /** "system" follows the device, through the CSS prefers-color-scheme media feature. */
  theme: 'system' | 'light' | 'dark';
  /** A grey mention ramp that does not rely on telling red from green. */
  colorblind: boolean;
  /** How a majority judgment ballot is filled in: a colour scale per option, or a dropdown per option. */
  mjBallot: 'scale' | 'dropdown';
  /** Live: every change is cast at once. Envelope: changes are reviewed, then submitted together. */
  submission: 'live' | 'envelope';
}

const DEFAULTS: Preferences = { theme: 'system', colorblind: false, mjBallot: 'scale', submission: 'live' };
const STORAGE_KEY = 'zvote.preferences';

export function loadPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULTS; // Storage disabled, or unreadable.
  }
}

/** Reflects the preferences on the document, where the stylesheets look for them. */
export function applyPreferences({ theme, colorblind }: Preferences) {
  const root = document.documentElement;
  if (theme === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
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
