import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { StarterDetailScreen } from '../screens/home/StarterDetailScreen';
import { FeedWizardScreen } from '../screens/home/FeedWizardScreen';
import { ConfirmPeakScreen } from '../screens/home/ConfirmPeakScreen';
import { EditStarterScreen } from '../screens/home/EditStarterScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontFamily: theme.typography.headingFamily,
          color: theme.colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{
          title: 'StarterBuddy',
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen
        name="StarterDetail"
        component={StarterDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="FeedWizard"
        component={FeedWizardScreen}
        options={{ title: '', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="ConfirmPeak"
        component={ConfirmPeakScreen}
        options={{ title: '', presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditStarter"
        component={EditStarterScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}
