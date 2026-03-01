import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { PlannerStackParamList } from './types';
import { PlannerScreen } from '../screens/planner/PlannerScreen';

const Stack = createNativeStackNavigator<PlannerStackParamList>();

export function PlannerNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: theme.typography.headingFamily,
          color: theme.colors.text,
        },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="PlannerMain"
        component={PlannerScreen}
        options={{ title: 'Levain Planner' }}
      />
    </Stack.Navigator>
  );
}
