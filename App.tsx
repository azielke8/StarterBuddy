import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';
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
  const hasLoggedResolvedBeforeNavRef = React.useRef(false);
  const previousIsProRef = React.useRef<boolean | null>(null);
  const hasLoggedPlaceholderRef = React.useRef(false);

  React.useEffect(() => {
    if (!__DEV__) return;
    if (themeReady && initialized && !hasLoggedThemeReadyRef.current) {
      hasLoggedThemeReadyRef.current = true;
      console.log('themeReady true (subscription initialized)');
    }
  }, [themeReady, initialized]);

  React.useEffect(() => {
    if (!__DEV__) return;
    if (!themeReady || !initialized || hasLoggedResolvedBeforeNavRef.current) return;
    hasLoggedResolvedBeforeNavRef.current = true;
    console.log(`resolved mode before NavigationContainer mount: ${mode}`);
  }, [themeReady, initialized, mode]);

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
    if (__DEV__ && !hasLoggedPlaceholderRef.current) {
      hasLoggedPlaceholderRef.current = true;
      console.log(
        `App placeholder render: themeReady=${themeReady} initialized=${initialized} mode=${mode}`
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {__DEV__ && (
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>{`mode: ${mode}`}</Text>
            <Text style={styles.debugText}>{`themeReady: ${themeReady}`}</Text>
            <Text style={styles.debugText}>{`initialized: ${initialized}`}</Text>
            <View style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: theme.colors.background }]} />
              <View style={[styles.swatch, { backgroundColor: theme.colors.inputBackground }]} />
              <View style={[styles.swatch, { backgroundColor: theme.colors.text }]} />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer
        key={navKey}
        onReady={() => {
          if (__DEV__) {
            console.log(`NavigationContainer mounted (mode=${mode})`);
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
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>{`mode: ${mode}`}</Text>
          <Text style={styles.debugText}>{`themeReady: ${themeReady}`}</Text>
          <Text style={styles.debugText}>{`initialized: ${initialized}`}</Text>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.background }]} />
            <View style={[styles.swatch, { backgroundColor: theme.colors.inputBackground }]} />
            <View style={[styles.swatch, { backgroundColor: theme.colors.text }]} />
          </View>
        </View>
      )}
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

const styles = StyleSheet.create({
  debugOverlay: {
    position: 'absolute',
    top: 40,
    left: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 9999,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 11,
    marginBottom: 2,
  },
  swatchRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
