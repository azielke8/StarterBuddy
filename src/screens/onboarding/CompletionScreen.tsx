import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading } from '../../components/Typography';
import { Button } from '../../components/Button';
import { OnboardingStackParamList } from '../../navigation/types';
import { createStarter } from '../../db';
import { requestNotificationPermission, scheduleFeedReminder } from '../../services/notificationService';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Completion'>;

export function CompletionScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { name, storageMode, hydration, feedIntervalHours } = route.params;
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    setLoading(true);
    try {
      const starter = await createStarter({
        name,
        storage_mode: storageMode,
        hydration_target: hydration,
        default_feed_interval_hours: feedIntervalHours,
      });

      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleFeedReminder(starter.id, starter.name, starter.default_feed_interval_hours);
      }

      // Navigate to main tabs — the root navigator will switch automatically
      // since starter count > 0
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'MainTabs' as any }],
      });
    } catch (error) {
      console.error('Failed to create starter:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Heading style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>
          {name} is ready.
        </Heading>
        <Subheading style={{ textAlign: 'center', lineHeight: 22 }}>
          Your culture is ready.{'\n'}Let’s begin.
        </Subheading>
      </View>
      <View style={styles.footer}>
        <Button
          title="Go to Dashboard"
          onPress={handleFinish}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
});
