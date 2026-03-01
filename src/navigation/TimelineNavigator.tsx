import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { TimelineStackParamList } from './types';
import { TimelineScreen } from '../screens/timeline/TimelineScreen';

const Stack = createNativeStackNavigator<TimelineStackParamList>();

export function TimelineNavigator() {
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
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="TimelineMain"
        component={TimelineScreen}
        options={{ title: 'Timeline' }}
      />
    </Stack.Navigator>
  );
}
