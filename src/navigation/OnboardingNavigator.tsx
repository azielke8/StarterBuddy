import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { OnboardingStackParamList } from './types';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { NameStarterScreen } from '../screens/onboarding/NameStarterScreen';
import { SetHomeScreen } from '../screens/onboarding/SetHomeScreen';
import { HydrationScreen } from '../screens/onboarding/HydrationScreen';
import { FeedingRhythmScreen } from '../screens/onboarding/FeedingRhythmScreen';
import { CompletionScreen } from '../screens/onboarding/CompletionScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="NameStarter" component={NameStarterScreen} />
      <Stack.Screen name="SetHome" component={SetHomeScreen} />
      <Stack.Screen name="Hydration" component={HydrationScreen} />
      <Stack.Screen name="FeedingRhythm" component={FeedingRhythmScreen} />
      <Stack.Screen name="Completion" component={CompletionScreen} />
    </Stack.Navigator>
  );
}
