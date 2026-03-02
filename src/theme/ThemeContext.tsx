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
  const initialModeGuessRef = React.useRef<ThemeMode>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const initialModeGuess = initialModeGuessRef.current;
  const [themeState, setThemeState] = useState<{
    preferredMode: ThemeMode;
    modeLoaded: boolean;
  }>({
    preferredMode: initialModeGuess,
    modeLoaded: false,
  });

  useEffect(() => {
    if (__DEV__) {
      console.log(`theme initial mode guess: ${initialModeGuess}`);
    }
  }, []);

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
        setThemeState({ preferredMode: resolvedMode, modeLoaded: true });
        if (__DEV__) {
          console.log(`theme stored mode loaded: ${resolvedMode}`);
          console.log('theme modeLoaded flipped: true');
        }
      }
    }

    void loadPreferredMode();
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setThemeState((prev) => ({ ...prev, preferredMode: newMode }));
    void (async () => {
      try {
        await THEME_MODE_FILE.create({ overwrite: true });
        await THEME_MODE_FILE.write(newMode);
      } catch {
        // Ignore persistence failures and keep in-memory mode.
      }
    })();
  }, []);

  const mode: ThemeMode = isPro ? themeState.preferredMode : 'light';
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const themeReady = themeState.modeLoaded && initialized;
  const previousModeRef = React.useRef<ThemeMode | null>(null);

  useEffect(() => {
    if (__DEV__ && themeReady) {
      console.log(`theme resolved mode final: ${mode}`);
    }
  }, [mode, themeReady]);

  useEffect(() => {
    if (!__DEV__) return;
    if (previousModeRef.current === null) {
      previousModeRef.current = mode;
      return;
    }
    if (previousModeRef.current !== mode) {
      console.log(`theme mode transition: ${previousModeRef.current} -> ${mode}`);
      previousModeRef.current = mode;
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, isDark: mode === 'dark', themeReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
