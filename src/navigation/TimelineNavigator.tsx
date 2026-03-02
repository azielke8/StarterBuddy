import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { TimelineStackParamList } from './types';
import { TimelineScreen } from '../screens/timeline/TimelineScreen';
import { HeaderIconButton } from '../components/nav/HeaderIconButton';

const Stack = createNativeStackNavigator<TimelineStackParamList>();

export function TimelineNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerTransparent: false,
        headerBackVisible: false,
        headerLargeTitle: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerBackground: () => (
          <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
        ),
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: theme.typography.headingFamily,
          color: theme.colors.text,
        },
        headerBackTitleVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <HeaderIconButton
              iconName="chevron-back"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
            />
          ) : null,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      })}
    >
      <Stack.Screen
        name="TimelineMain"
        component={TimelineScreen}
        options={{ title: 'Timeline' }}
      />
    </Stack.Navigator>
  );
}
