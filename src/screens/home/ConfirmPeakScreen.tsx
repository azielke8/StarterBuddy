import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { getLastFeedEvent, updateEventPeak, getConfirmedPeaks, updateStarter } from '../../db';
import { computeRollingAveragePeak } from '../../utils/feedCalculations';
import { HomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'ConfirmPeak'>;

export function ConfirmPeakScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { starterId, starterName } = route.params;
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const totalHours = h + m / 60;
    if (totalHours <= 0) return;

    setSaving(true);
    try {
      const lastFeed = await getLastFeedEvent(starterId);
      if (lastFeed) {
        await updateEventPeak(lastFeed.id, totalHours);
      }

      // Update rolling average
      const confirmedPeaks = await getConfirmedPeaks(starterId);
      const peakHoursList = confirmedPeaks
        .map((e) => e.peak_confirmed_hours)
        .filter((h): h is number => h != null);
      // Include the new one
      peakHoursList.unshift(totalHours);

      const newBaseline = computeRollingAveragePeak(peakHoursList);
      if (newBaseline != null) {
        await updateStarter(starterId, { baseline_peak_hours: newBaseline });
      }

      navigation.goBack();
    } catch (e) {
      console.error('Failed to confirm peak:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Heading style={{ marginBottom: 8 }}>Confirm Peak</Heading>
        <Body style={{ color: theme.colors.textSecondary, marginBottom: 32 }}>
          How long after feeding did {starterName} peak?
        </Body>

        <View style={styles.timeRow}>
          <TextInput
            label="Hours"
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
            placeholder="0"
          />
          <TextInput
            label="Minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>

        <Caption style={{ marginTop: 8 }}>
          This helps improve future peak predictions.
        </Caption>
      </View>
      <View style={styles.footer}>
        <Button
          title="Confirm"
          onPress={handleConfirm}
          loading={saving}
          disabled={(parseInt(hours, 10) || 0) + (parseInt(minutes, 10) || 0) <= 0}
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
    paddingHorizontal: 24,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
});
