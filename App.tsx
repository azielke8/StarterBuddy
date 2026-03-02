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
  const { isPro } = useSubscription();
  const navKey = `${mode}-${isPro ? 'pro' : 'free'}`;

  React.useEffect(() => {
    if (__DEV__) {
      console.log(`NAV_KEY changed: ${navKey}`);
    }
  }, [navKey]);

  if (!themeReady) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer
        key={navKey}
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
