import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { File, Paths } from 'expo-file-system';
import { Appearance } from 'react-native';
import { lightTheme, darkTheme, Theme } from './tokens';
import { useSubscription } from '../contexts/SubscriptionContext';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  themeReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'light',
  setMode: () => {},
  isDark: false,
  themeReady: false,
});

const THEME_MODE_FILE = new File(Paths.document, 'theme-mode.txt');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isPro, initialized } = useSubscription();
  const initialModeGuess: ThemeMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [preferredMode, setPreferredMode] = useState<ThemeMode>(initialModeGuess);
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log(`theme initial mode guess: ${initialModeGuess}`);
    }
  }, [initialModeGuess]);

  useEffect(() => {
    async function loadPreferredMode() {
      let resolvedMode = initialModeGuess;
      try {
        const stored = (await THEME_MODE_FILE.text()).trim();
        if (stored === 'light' || stored === 'dark') {
          resolvedMode = stored;
        }
      } catch {
        // No saved preference yet.
      } finally {
        setPreferredMode(resolvedMode);
        if (__DEV__) {
          console.log(`theme stored mode loaded: ${resolvedMode}`);
        }
        setModeLoaded(true);
      }
    }

    void loadPreferredMode();
  }, [initialModeGuess]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setPreferredMode(newMode);
    try {
      THEME_MODE_FILE.create({ overwrite: true });
      THEME_MODE_FILE.write(newMode);
    } catch {
      // Ignore persistence failures and keep in-memory mode.
    }
  }, []);

  const mode: ThemeMode = isPro ? preferredMode : 'light';
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const themeReady = modeLoaded && initialized;

  useEffect(() => {
    if (__DEV__ && themeReady) {
      console.log(`theme resolved mode final: ${mode}`);
    }
  }, [mode, themeReady]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, isDark: mode === 'dark', themeReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
