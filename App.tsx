import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useSubscription } from './src/contexts/SubscriptionContext';

function AppContent() {
  const { theme, isDark, themeReady, mode } = useTheme();
  const { isPro, initialized } = useSubscription();
  const navKey = mode;
  const hasLoggedThemeReadyRef = React.useRef(false);
  const previousIsProRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!__DEV__) return;
    if (themeReady && initialized && !hasLoggedThemeReadyRef.current) {
      hasLoggedThemeReadyRef.current = true;
      console.log('themeReady true (subscription initialized)');
    }
  }, [themeReady, initialized]);

  React.useEffect(() => {
    if (!__DEV__) return;
    if (!initialized) return;
    if (previousIsProRef.current === null) {
      previousIsProRef.current = isPro;
      return;
    }
    if (previousIsProRef.current !== isPro) {
      console.log(`isPro changed after init: ${isPro ? 'pro' : 'free'}`);
      previousIsProRef.current = isPro;
    }
  }, [initialized, isPro]);

  if (!themeReady || !initialized) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer
        key={navKey}
        onReady={() => {
          if (__DEV__) {
            console.log('NavigationContainer mounted');
          }
        }}
        theme={{
          dark: isDark,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.background,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.primary,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '800' },
          },
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SubscriptionProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </SubscriptionProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
