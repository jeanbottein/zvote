import React, { createContext, useContext, useState, useEffect } from 'react';

export type MajorityJudgmentBallotView = 'table' | 'form';

interface UserPreferences {
  mjBallotView: MajorityJudgmentBallotView;
}

const defaultPreferences: UserPreferences = {
  mjBallotView: 'table',
};

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('zvote-preferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch (e) {
        console.warn('Failed to parse stored preferences:', e);
      }
    }
  }, []);

  const updatePreferences = (prefs: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...prefs };
    setPreferences(updated);
    localStorage.setItem('zvote-preferences', JSON.stringify(updated));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('zvote-preferences');
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};
