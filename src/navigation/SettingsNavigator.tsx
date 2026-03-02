import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../theme';
import { SettingsStackParamList } from './types';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ExportImportScreen } from '../screens/settings/ExportImportScreen';
import { NotificationsSettingsScreen } from '../screens/settings/NotificationsSettingsScreen';
import { AppearanceScreen } from '../screens/settings/AppearanceScreen';
import { SubscriptionScreen } from '../screens/settings/SubscriptionScreen';
import { AboutScreen } from '../screens/settings/AboutScreen';
import { AnalyticsScreen } from '../screens/settings/AnalyticsScreen';

const Stack = createStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: theme.typography.headingFamily,
          color: theme.colors.text,
        },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="ExportImport" component={ExportImportScreen} options={{ title: 'Export & Import' }} />
      <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Appearance' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
    </Stack.Navigator>
  );
}
