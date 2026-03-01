import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { StarterDetailScreen } from '../screens/home/StarterDetailScreen';
import { FeedWizardScreen } from '../screens/home/FeedWizardScreen';
import { ConfirmPeakScreen } from '../screens/home/ConfirmPeakScreen';
import { EditStarterScreen } from '../screens/home/EditStarterScreen';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getStarterCount } from '../db';

const Stack = createNativeStackNavigator<HomeStackParamList>();

function HomeHeaderAddButton({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();

  const handlePress = async () => {
    if (!isPro) {
      const starterCount = await getStarterCount();
      if (starterCount >= 1) {
        navigation.getParent()?.navigate(
          'ProPaywall' as any,
          {
            trigger: 'multi_culture_locked_action',
            placement: 'home_add_starter',
            title: 'Manage multiple cultures',
            message: 'Pro unlocks all your cultures and lets you plan each one.',
          } as any
        );
        return;
      }
    }
    navigation.navigate('EditStarter', { mode: 'create' });
  };

  return (
    <Pressable onPress={() => void handlePress()} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <Ionicons name="add-circle-outline" size={26} color={theme.colors.primary} />
    </Pressable>
  );
}

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
        options={({ navigation }) => ({
          title: 'StarterBuddy',
          headerTitleAlign: 'center',
          headerRight: () => <HomeHeaderAddButton navigation={navigation} />,
        })}
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
