import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { SubscriptionScreen } from '../screens/settings/SubscriptionScreen';
import { getStarterCount } from '../db';
import { useTheme } from '../theme';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'MainTabs' | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const count = await getStarterCount();
        setInitialRoute(count === 0 ? 'Onboarding' : 'MainTabs');
      } catch (e) {
        console.error('Failed to check starter count:', e);
        setInitialRoute('Onboarding');
      }
    }
    check();
  }, []);

  if (initialRoute === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="ProPaywall"
        component={SubscriptionScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
