import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { PlannerStackParamList } from './types';
import { PlannerScreen } from '../screens/planner/PlannerScreen';
import { ProUpsellScreen } from '../screens/planner/ProUpsellScreen';
import { useSubscription } from '../contexts/SubscriptionContext';

const Stack = createNativeStackNavigator<PlannerStackParamList>();

export function PlannerNavigator() {
  const { theme } = useTheme();
  const { isPro } = useSubscription();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="PlannerMain"
        component={isPro ? PlannerScreen : ProUpsellScreen}
      />
    </Stack.Navigator>
  );
}
