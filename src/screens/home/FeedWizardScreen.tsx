import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextInput } from '../../components/TextInput';
import { getStarter, getLastFeedEvent, createEvent, updateStarter } from '../../db';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Starter } from '../../models/types';
import {
  calculateFeed,
  getSuggestionIfDifferent,
  computePeakTime,
} from '../../utils/feedCalculations';
import { scheduleFeedReminder, schedulePeakNotification } from '../../services/notificationService';
import { HomeStackParamList } from '../../navigation/types';
import { FRIDGE_INTERVAL_HOURS } from '../../constants/storage';
import { ensureActiveStarterId } from '../../utils/activeStarter';
import {
  SCREEN_HPAD,
  SECTION_GAP,
  CARD_GAP,
  CARD_PAD_COMPACT,
  ROW_PAD_Y_COMPACT,
} from '../../theme/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'FeedWizard'>;

const GOALS = ['Maintain', 'Build Levain', 'Revive', 'Chill'];

export function FeedWizardScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const insets = useSafeAreaInsets();
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
  const [hasEditedRatio, setHasEditedRatio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [starterCount, setStarterCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { activeStarterId: activeId, starterCount: count } = await ensureActiveStarterId(isPro);
      setStarterCount(count);
      setActiveStarterIdState(activeId);
      const s = await getStarter(starterId);
      if (s) {
        setStarter(s);
        setHydration(String(s.hydration_target));
        setRatioA(String(s.preferred_ratio_a));
        setRatioB(String(s.preferred_ratio_b));
        setRatioC(String(s.preferred_ratio_c));
        setHasEditedRatio(false);

        const lastFeed = await getLastFeedEvent(s.id);
        if (lastFeed?.starter_g) {
          setCurrentStarter(String(lastFeed.starter_g));
        }
      }
    }
    void load();
  }, [isPro, starterId]);

  const isLocked =
    !isPro &&
    starterCount > 1 &&
    !!activeStarterId &&
    !!starter &&
    starter.id !== activeStarterId;

  useEffect(() => {
    if (goalIndex === 2 && !hasEditedRatio) {
      setRatioA('1');
      setRatioB('2');
      setRatioC('2');
    }
  }, [goalIndex, hasEditedRatio]);

  const handleRatioAChange = useCallback((value: string) => {
    setHasEditedRatio(true);
    setRatioA(value);
  }, []);

  const handleRatioBChange = useCallback((value: string) => {
    setHasEditedRatio(true);
    setRatioB(value);
  }, []);

  const handleRatioCChange = useCallback((value: string) => {
    setHasEditedRatio(true);
    setRatioC(value);
  }, []);

  const rA = parseInt(ratioA, 10) || 1;
  const rB = parseInt(ratioB, 10) || 1;
  const rC = parseInt(ratioC, 10) || 1;
  const total = parseInt(desiredTotal, 10) || 0;
  const currentStarterG = Math.max(0, parseInt(currentStarter, 10) || 0);
  const hydrationPercent = Math.max(0, parseInt(hydration, 10) || 0);

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
      setHasEditedRatio(true);
      setRatioA(String(suggestion.ratio[0]));
      setRatioB(String(suggestion.ratio[1]));
      setRatioC(String(suggestion.ratio[2]));
    }
  }

  function handleOpenLevainPlanner() {
    if (isPro) {
      navigation.getParent()?.navigate('PlannerTab' as never);
      return;
    }
    navigation.getParent()?.navigate('ProPaywall' as any, {
      placement: 'planner_entry',
      title: 'Unlock levain planning',
      message: "Levain planning is included with Baker's Table.",
    } as any);
  }

  async function handleMoveToFridge() {
    if (!starter || isLocked) return;
    setSaving(true);
    try {
      await updateStarter(starter.id, {
        storage_mode: 'fridge',
        default_feed_interval_hours: FRIDGE_INTERVAL_HOURS,
      });
      await createEvent({
        starter_id: starter.id,
        type: 'NOTE',
        timestamp: new Date().toISOString(),
        notes: 'Moved to fridge.',
      });
      Alert.alert('Moved to fridge');
      navigation.goBack();
    } catch (e) {
      console.error('Failed to move to fridge:', e);
      Alert.alert('Could not move to fridge');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogFeed() {
    if (!starter || isLocked) return;
    if (goalIndex === 3) {
      await handleMoveToFridge();
      return;
    }
    setSaving(true);
    try {
      await createEvent({
        starter_id: starter.id,
        type: 'FEED',
        starter_g: calculation.starter_g,
        flour_g: calculation.flour_g,
        water_g: calculation.water_g,
        ratio_string: calculation.ratio_string,
        notes: goalIndex === 1 ? 'Levain build' : undefined,
      });

      // Schedule reminders
      await scheduleFeedReminder(starter.id, starter.name, starter.default_feed_interval_hours);

      if (goalIndex === 1 && calculation.estimated_peak_hours > 0) {
        const peakTime = computePeakTime(
          new Date().toISOString(),
          calculation.estimated_peak_hours
        );
        try {
          await schedulePeakNotification(starter.id, starter.name, peakTime);
        } catch (e) {
          if (__DEV__) {
            console.error('Failed to schedule levain peak notification:', e);
          }
        }
      }

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

  const discardG = Math.max(currentStarterG - calculation.starter_g, 0);
  const finalDisplayedG = calculation.starter_g + calculation.flour_g + calculation.water_g;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Heading style={{ fontFamily: 'Georgia', marginBottom: SECTION_GAP }}>Refresh Culture</Heading>

      {/* Goal */}
      <Label style={{ marginBottom: 8 }}>Goal</Label>
      <SegmentedControl options={GOALS} selectedIndex={goalIndex} onSelect={setGoalIndex} />
      {goalIndex === 1 && (
        <View style={{ marginTop: 12 }}>
          <Banner
            message="Want levain ready at a specific time? Levain Planner (Pro) calculates start time and saves a plan."
            actionLabel="Open Levain Planner"
            onAction={handleOpenLevainPlanner}
            variant="info"
          />
        </View>
      )}
      {isLocked && (
        <View style={{ marginTop: 12 }}>
          <Banner
            message={"Multiple cultures are a Pro feature.\nUpgrade to unlock unlimited cultures."}
            variant="info"
            actionLabel="Upgrade"
            onAction={() => navigation.getParent()?.navigate('ProPaywall' as never)}
          />
        </View>
      )}
      {goalIndex === 1 && (
        <Card style={{ marginHorizontal: 0, marginTop: 12, padding: CARD_PAD_COMPACT }}>
          <Label style={{ marginBottom: 8 }}>Levain timing</Label>
          <View style={styles.outputRow}>
            <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Ready in</Caption>
            <Body>{calculation.estimated_peak_hours}h</Body>
          </View>
          <View style={styles.outputRow}>
            <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Peak around</Caption>
            <Body>{peakClockTime}</Body>
          </View>
        </Card>
      )}
      {goalIndex === 2 && (
        <View style={{ marginTop: 12 }}>
          <Banner
            message="Revive uses a stronger feed to rebuild activity."
            variant="info"
          />
        </View>
      )}
      {goalIndex === 3 && (
        <View style={{ marginTop: 12 }}>
          <Banner
            message="Chill moves your culture to the fridge and slows feeding."
            variant="info"
          />
        </View>
      )}
      {goalIndex === 3 && (
        <Card style={{ marginHorizontal: 0, marginTop: SECTION_GAP, padding: CARD_PAD_COMPACT }}>
          <Label style={{ marginBottom: 8 }}>What this does</Label>
          <Caption style={{ marginBottom: 6 }}>- Moves culture to the fridge</Caption>
          <Caption style={{ marginBottom: 6 }}>
            - Sets feed interval to {FRIDGE_INTERVAL_HOURS}h
          </Caption>
          <Caption>- Logs a note in the timeline</Caption>
        </Card>
      )}

      {/* Inputs */}
      {goalIndex !== 3 && (
      <View style={{ marginTop: SECTION_GAP }}>
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

        <View style={{ marginTop: SECTION_GAP }}>
          <View style={styles.ratioRow}>
          <View style={styles.ratioField}>
            <TextInput
              label="Ratio (starter)"
              value={ratioA}
              onChangeText={handleRatioAChange}
              keyboardType="number-pad"
              style={styles.ratioInput}
            />
          </View>
          <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
          <View style={styles.ratioField}>
            <TextInput
              label="Flour"
              value={ratioB}
              onChangeText={handleRatioBChange}
              keyboardType="number-pad"
              style={styles.ratioInput}
            />
          </View>
          <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
          <View style={styles.ratioField}>
            <TextInput
              label="Water"
              value={ratioC}
              onChangeText={handleRatioCChange}
              keyboardType="number-pad"
              style={styles.ratioInput}
            />
          </View>
          </View>
        </View>
      </View>
      )}
      {goalIndex !== 3 && hydrationPercent !== 100 && (
        <Caption style={{ marginTop: 8, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
          Hydration adjusts water amount and may change the effective ratio.
        </Caption>
      )}

      {/* Dynamic suggestion */}
      {goalIndex !== 3 && suggestion && (
        <View style={[styles.suggestion, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, borderRadius: theme.radii.xl }]}>
          <Caption>
            Suggested ratio for {suggestion.hours}h peak:{' '}
            {suggestion.ratio.join(':')}
          </Caption>
          <TouchableOpacity onPress={applySuggestion} style={{ paddingHorizontal: 6 }}>
            <Text style={[styles.applyLink, { color: theme.colors.primary }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Output */}
      {goalIndex !== 3 && (
      <Card style={{ marginHorizontal: 0, marginTop: SECTION_GAP, padding: CARD_PAD_COMPACT }}>
        <Label style={{ marginBottom: 12 }}>Steps</Label>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>1. Keep</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.starter_g}g starter</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>2. Discard</Caption>
          <Body style={{ fontWeight: '600' }}>
            {discardG === 0 ? 'none needed' : `${discardG}g`}
          </Body>
        </View>
        {discardG > 0 && (
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary, marginTop: 2, marginBottom: 4 }}>
            Discard the rest (to get down to {calculation.starter_g}g).
          </Caption>
        )}
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>3. Add</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.flour_g}g flour</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>4. Add</Caption>
          <Body style={{ fontWeight: '600' }}>{calculation.water_g}g water</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>5. Mix</Caption>
          <Body style={{ fontWeight: '600' }}>final: {finalDisplayedG}g</Body>
        </View>
        <Label style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: theme.colors.border, marginBottom: 4 }}>
          Output
        </Label>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Starter</Caption>
          <Body style={{ fontWeight: '600', fontSize: 17 }}>{calculation.starter_g}g</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Flour</Caption>
          <Body style={{ fontWeight: '600', fontSize: 17 }}>{calculation.flour_g}g</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Water</Caption>
          <Body style={{ fontWeight: '600', fontSize: 17 }}>{calculation.water_g}g</Body>
        </View>
        <View style={[styles.outputRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: theme.colors.border }]}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Ratio</Caption>
          <Body>{calculation.ratio_string}</Body>
        </View>
        <View style={styles.outputRow}>
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Estimated peak</Caption>
          <Body>
            {calculation.estimated_peak_hours}h (~{peakClockTime})
          </Body>
        </View>
      </Card>
      )}

      <Button
        title={goalIndex === 3 ? 'Move to fridge' : goalIndex === 1 ? 'Log Levain Build' : 'Log Feed'}
        onPress={handleLogFeed}
        loading={saving}
        disabled={isLocked}
        style={{ marginTop: SECTION_GAP + CARD_GAP }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SCREEN_HPAD,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  ratioField: {
    flex: 1,
    minWidth: 96,
    flexShrink: 0,
  },
  ratioSep: {
    fontSize: 20,
    marginBottom: 24,
    fontWeight: '300',
  },
  ratioInput: {
    minHeight: 52,
    minWidth: 96,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 18,
    textAlign: 'left',
    flexShrink: 0,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: CARD_PAD_COMPACT,
    paddingLeft: 14,
    paddingRight: 16,
    borderWidth: 1,
    marginTop: SECTION_GAP,
  },
  applyLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  outputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ROW_PAD_Y_COMPACT,
  },
});
