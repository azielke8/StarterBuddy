import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { MainTabsParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { TimelineNavigator } from './TimelineNavigator';
import { PlannerNavigator } from './PlannerNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import { useSubscription } from '../contexts/SubscriptionContext';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabNavigator() {
  const { theme } = useTheme();
  const { isPro } = useSubscription();

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
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'TimelineTab') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'PlannerTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'SettingsTab') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
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
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            if (isPro) return;
            event.preventDefault();
            navigation.getParent()?.navigate('ProPaywall' as any, {
              placement: 'planner_entry',
              title: 'Unlock levain planning',
              message: "Levain planning is included with Baker's Table.",
            } as any);
          },
        })}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}
