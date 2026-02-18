import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextInput } from '../../components/TextInput';
import { getStarter, getLastFeedEvent, createEvent } from '../../db';
import { Starter } from '../../models/types';
import {
  calculateFeed,
  suggestRatioForHours,
  getSuggestionIfDifferent,
  computePeakTime,
} from '../../utils/feedCalculations';
import { scheduleFeedReminder, schedulePeakNotification } from '../../services/notificationService';
import { HomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'FeedWizard'>;

const GOALS = ['Maintain', 'Build Levain', 'Revive', 'Chill'];

export function FeedWizardScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { starterId, goal: initialGoal } = route.params;
  const [starter, setStarter] = useState<Starter | null>(null);
  const [goalIndex, setGoalIndex] = useState(
    initialGoal ? GOALS.indexOf(initialGoal) : 0
  );
  const [currentStarter, setCurrentStarter] = useState('50');
  const [desiredTotal, setDesiredTotal] = useState('150');
  const [hydration, setHydration] = useState('100');
  const [ratioA, setRatioA] = useState('1');
  const [ratioB, setRatioB] = useState('3');
  const [ratioC, setRatioC] = useState('3');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await getStarter(starterId);
      if (s) {
        setStarter(s);
        setHydration(String(s.hydration_target));
        setRatioA(String(s.preferred_ratio_a));
        setRatioB(String(s.preferred_ratio_b));
        setRatioC(String(s.preferred_ratio_c));

        const lastFeed = await getLastFeedEvent(s.id);
        if (lastFeed?.starter_g) {
          setCurrentStarter(String(lastFeed.starter_g));
        }
      }
    }
    load();
  }, [starterId]);

  const rA = parseInt(ratioA, 10) || 1;
  const rB = parseInt(ratioB, 10) || 1;
  const rC = parseInt(ratioC, 10) || 1;
  const total = parseInt(desiredTotal, 10) || 0;

  const calculation = useMemo(
    () => calculateFeed(total, parseInt(hydration, 10) || 100, rA, rB, rC, starter?.baseline_peak_hours),
    [total, hydration, rA, rB, rC, starter?.baseline_peak_hours]
  );

  // Dynamic suggestion
  const targetHours = starter?.default_feed_interval_hours ?? 12;
  const suggestion = useMemo(
    () => getSuggestionIfDifferent(targetHours, rA, rB, rC),
    [targetHours, rA, rB, rC]
  );

  function applySuggestion() {
    if (suggestion) {
      setRatioA(String(suggestion.ratio[0]));
      setRatioB(String(suggestion.ratio[1]));
      setRatioC(String(suggestion.ratio[2]));
    }
  }

  async function handleLogFeed() {
    if (!starter) return;
    setSaving(true);
    try {
      await createEvent({
        starter_id: starter.id,
        type: goalIndex === 3 ? 'DISCARD' : 'FEED',
        starter_g: calculation.starter_g,
        flour_g: calculation.flour_g,
        water_g: calculation.water_g,
        ratio_string: calculation.ratio_string,
      });

      // Schedule reminders
      await scheduleFeedReminder(starter.id, starter.name, starter.default_feed_interval_hours);

      // Schedule peak notification
      const peakTime = computePeakTime(new Date().toISOString(), calculation.estimated_peak_hours);
      await schedulePeakNotification(starter.id, starter.name, peakTime);

      navigation.goBack();
    } catch (e) {
      console.error('Failed to log feed:', e);
    } finally {
      setSaving(false);
    }
  }

  const peakClockTime = useMemo(() => {
    const peak = new Date(Date.now() + calculation.estimated_peak_hours * 60 * 60 * 1000);
    return peak.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [calculation.estimated_peak_hours]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Heading style={{ fontFamily: 'Georgia', marginBottom: 24 }}>Refresh Culture</Heading>

      {/* Goal */}
      <Label style={{ marginBottom: 8 }}>Goal</Label>
      <SegmentedControl options={GOALS} selectedIndex={goalIndex} onSelect={setGoalIndex} />

      {/* Inputs */}
      <View style={{ marginTop: 28 }}>
        <Label style={{ marginBottom: 12 }}>Amounts</Label>
        <TextInput
          label="Current starter"
          suffix="g"
          value={currentStarter}
          onChangeText={setCurrentStarter}
          keyboardType="number-pad"
        />
        <TextInput
          label="Desired final amount"
          suffix="g"
          value={desiredTotal}
          onChangeText={setDesiredTotal}
          keyboardType="number-pad"
        />
        <TextInput
          label="Hydration"
          suffix="%"
          value={hydration}
          onChangeText={setHydration}
          keyboardType="number-pad"
        />

        <View style={styles.ratioRow}>
          <TextInput
            label="Ratio (starter)"
            value={ratioA}
            onChangeText={setRatioA}
            keyboardType="number-pad"
            style={{ textAlign: 'center' }}
          />
          <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
          <TextInput
            label="Flour"
            value={ratioB}
            onChangeText={setRatioB}
            keyboardType="number-pad"
            style={{ textAlign: 'center' }}
          />
          <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
          <TextInput
            label="Water"
            value={ratioC}
            onChangeText={setRatioC}
            keyboardType="number-pad"
            style={{ textAlign: 'center' }}
          />
        </View>
      </View>

      {/* Dynamic suggestion */}
      {suggestion && (
        <View style={[styles.suggestion, { borderColor: theme.colors.border }]}>
          <Caption>
            Suggested ratio for {suggestion.hours}h peak:{' '}
            {suggestion.ratio.join(':')}
          </Caption>
          <TouchableOpacity onPress={applySuggestion}>
            <Text style={[styles.applyLink, { color: theme.colors.accent }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Output */}
      <Card style={{ marginHorizontal: 0, marginTop: 24 }}>
        <Label style={{ marginBottom: 12 }}>Output</Label>
        <View style={styles.outputRow}>
          <Caption>Starter</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.starter_g}g</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption>Flour</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.flour_g}g</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption>Water</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.water_g}g</Body>
        </View>
        <View style={[styles.outputRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
          <Caption>Ratio</Caption>
          <Body>{calculation.ratio_string}</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption>Estimated peak</Caption>
          <Body>
            {calculation.estimated_peak_hours}h (~{peakClockTime})
          </Body>
        </View>
      </Card>

      <Button
        title="Log Feed"
        onPress={handleLogFeed}
        loading={saving}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  ratioSep: {
    fontSize: 20,
    marginBottom: 24,
    fontWeight: '300',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
  },
  applyLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  outputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
