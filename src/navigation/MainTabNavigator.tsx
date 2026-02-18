import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme';
import { MainTabsParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { TimelineNavigator } from './TimelineNavigator';
import { PlannerNavigator } from './PlannerNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import { Text, StyleSheet } from 'react-native';

const Tab = createBottomTabNavigator<MainTabsParamList>();

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    HomeTab: focused ? '●' : '○',
    TimelineTab: focused ? '◆' : '◇',
    PlannerTab: focused ? '▣' : '□',
    SettingsTab: focused ? '⚙' : '⚙',
  };
  return <Text style={[styles.icon, { color }]}>{icons[name] || '○'}</Text>;
}

export function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBackground,
          borderTopColor: theme.colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="TimelineTab"
        component={TimelineNavigator}
        options={{ tabBarLabel: 'Timeline' }}
      />
      <Tab.Screen
        name="PlannerTab"
        component={PlannerNavigator}
        options={{ tabBarLabel: 'Planner' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 18,
    marginBottom: -2,
  },
});
