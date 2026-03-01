import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, LayoutAnimation, Platform, UIManager, Alert, Switch } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { TextInput } from '../../components/TextInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import {
  createEvent,
  getActiveLevainSession,
  updateStarter,
} from '../../db';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Starter } from '../../models/types';
import {
  calculateLevainPlan,
  getPlannerPeakHours,
  getUpdatedBaselinePeakHours,
} from '../../utils/levainPlanner';
import {
  cancelScheduledNotification,
  requestNotificationPermission,
  scheduleOneTimeNotification,
} from '../../services/notificationService';
import {
  SCREEN_HPAD,
  SECTION_GAP,
  CARD_GAP,
  CARD_PAD_COMPACT,
  ROW_PAD_Y,
  ROW_PAD_Y_COMPACT,
} from '../../theme/spacing';
import { ensureActiveStarterId } from '../../utils/activeStarter';

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

type ReminderScheduleResult = 'scheduled' | 'cancel' | 'adjusted';
type CoachPhase =
  | 'not_started'
  | 'confirmed'
  | 'in_peak_window'
  | 'past_peak_window'
  | 'warming_up'
  | 'ready_now';
const READY_BY_PRESETS = [
  { label: 'Breakfast', hour: 8, minute: 0 },
  { label: 'Lunch', hour: 12, minute: 0 },
  { label: 'Dinner', hour: 18, minute: 0 },
];

export function PlannerScreen() {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [starters, setStarters] = useState<Starter[]>([]);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [desiredTotal, setDesiredTotal] = useState('200');
  const [hydration, setHydration] = useState('100');
  const [ratioA, setRatioA] = useState('1');
  const [ratioB, setRatioB] = useState('3');
  const [ratioC, setRatioC] = useState('3');
  const [recipeName, setRecipeName] = useState('');
  const [readyBy, setReadyBy] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000));
  const [saving, setSaving] = useState(false);
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [savedBannerMessage, setSavedBannerMessage] = useState('Levain plan added to Timeline');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStepsDetails, setShowStepsDetails] = useState(false);
  const [showEditInputs, setShowEditInputs] = useState(false);
  const [levainStartAt, setLevainStartAt] = useState<Date | null>(null);
  const [peakConfirmedAt, setPeakConfirmedAt] = useState<Date | null>(null);
  const [activeLevainAnchorY, setActiveLevainAnchorY] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [remindMe, setRemindMe] = useState(false);
  const [reminderIds, setReminderIds] = useState<string[]>([]);
  const reminderIdsRef = useRef<string[]>([]);
  const skipNextReminderSyncRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const refreshStarters = useCallback(async () => {
    const { activeStarterId: activeId, starters: all } = await ensureActiveStarterId(isPro);
    setStarters(all);
    setActiveStarterIdState(activeId ?? null);

    if (!selectedStarterId) {
      setSelectedStarterId(activeId ?? all[0]?.id ?? null);
    }
  }, [isPro, selectedStarterId]);

  useEffect(() => {
    refreshStarters();
  }, [refreshStarters]);

  useFocusEffect(
    useCallback(() => {
      refreshStarters();
    }, [refreshStarters])
  );

  useEffect(() => {
    let active = true;
    setLevainStartAt(null);
    setPeakConfirmedAt(null);
    setShowSavedBanner(false);
    setShowEditInputs(false);

    async function loadLevainStart() {
      if (!selectedStarterId) {
        return;
      }
      try {
        const session = await getActiveLevainSession(selectedStarterId);
        if (!active) return;
        if (!session || session.starter_id !== selectedStarterId) {
          setLevainStartAt(null);
          return;
        }
        setLevainStartAt(session.startAt);
      } catch (error) {
        console.error('Failed to load active levain session:', error);
        if (active) {
          setLevainStartAt(null);
        }
      }
    }

    loadLevainStart();
    return () => {
      active = false;
    };
  }, [selectedStarterId]);

  useEffect(() => {
    if (starters.length === 0) {
      setSelectedStarterId(null);
      return;
    }
    if (!selectedStarterId || !starters.some((s) => s.id === selectedStarterId)) {
      setSelectedStarterId(starters[0].id);
    }
  }, [starters, selectedStarterId]);

  const selectedStarter = useMemo(
    () => starters.find((s) => s.id === selectedStarterId) ?? null,
    [starters, selectedStarterId]
  );
  const isStarterLocked =
    !isPro &&
    starters.length > 1 &&
    !!selectedStarterId &&
    !!activeStarterId &&
    selectedStarterId !== activeStarterId;

  const selectedIndex = useMemo(
    () => starters.findIndex((s) => s.id === selectedStarterId),
    [starters, selectedStarterId]
  );

  const totalValue = parseInt(desiredTotal, 10);
  const hydrationValue = parseInt(hydration, 10);
  const ratioAValue = parseInt(ratioA, 10);
  const ratioBValue = parseInt(ratioB, 10);
  const ratioCValue = parseInt(ratioC, 10);

  const hasValidInputs =
    !!selectedStarter &&
    !isNaN(totalValue) &&
    !isNaN(hydrationValue) &&
    !isNaN(ratioAValue) &&
    !isNaN(ratioBValue) &&
    !isNaN(ratioCValue) &&
    totalValue > 0 &&
    hydrationValue > 0 &&
    ratioAValue > 0 &&
    ratioBValue > 0 &&
    ratioCValue > 0;

  const estimatedPeakHours = getPlannerPeakHours(selectedStarter);
  const peakConfidence = useMemo<'high' | 'medium' | 'low'>(() => {
    if ((selectedStarter?.baseline_peak_hours ?? 0) > 0) return 'high';
    if ((selectedStarter?.default_feed_interval_hours ?? 0) > 0) return 'medium';
    return 'low';
  }, [selectedStarter?.baseline_peak_hours, selectedStarter?.default_feed_interval_hours]);

  const plan = useMemo(
    () =>
      calculateLevainPlan({
        desired_total_g: totalValue || 0,
        hydration_percent: hydrationValue || 100,
        ratio_a: ratioAValue || 1,
        ratio_b: ratioBValue || 1,
        ratio_c: ratioCValue || 1,
        estimated_peak_hours: estimatedPeakHours,
        ready_by: readyBy,
      }),
    [totalValue, hydrationValue, ratioAValue, ratioBValue, ratioCValue, estimatedPeakHours, readyBy]
  );
  const peakWindowStart = useMemo(
    () => new Date(plan.ready_by.getTime() - 30 * 60 * 1000),
    [plan.ready_by]
  );
  const peakWindowEnd = useMemo(
    () => new Date(plan.ready_by.getTime() + 30 * 60 * 1000),
    [plan.ready_by]
  );
  const earliestReadyBy = useMemo(
    () => new Date(Date.now() + plan.estimated_peak_hours * 60 * 60 * 1000 + 5 * 60 * 1000),
    [plan.estimated_peak_hours]
  );
  const activeElapsedMs = useMemo(
    () => (levainStartAt ? Math.max(0, nowTick - levainStartAt.getTime()) : 0),
    [levainStartAt, nowTick]
  );
  const isWithinPeakWindow = useMemo(
    () =>
      nowTick >= peakWindowStart.getTime() &&
      nowTick <= peakWindowEnd.getTime(),
    [nowTick, peakWindowStart, peakWindowEnd]
  );
  const isReadyNow = useMemo(
    () => nowTick >= plan.ready_by.getTime(),
    [nowTick, plan.ready_by]
  );
  const recipeTrimmed = useMemo(() => recipeName.trim(), [recipeName]);
  const coachPhase = useMemo<CoachPhase>(() => {
    if (!levainStartAt) return 'not_started';
    if (peakConfirmedAt) return 'confirmed';
    if (isReadyNow) return 'ready_now';
    if (isWithinPeakWindow) return 'in_peak_window';
    if (nowTick > peakWindowEnd.getTime()) return 'past_peak_window';
    return 'warming_up';
  }, [levainStartAt, peakConfirmedAt, isReadyNow, isWithinPeakWindow, nowTick, peakWindowEnd]);

  useEffect(() => {
    if (!levainStartAt) return;
    const intervalId = setInterval(() => {
      setNowTick(Date.now());
    }, 30 * 1000);
    return () => clearInterval(intervalId);
  }, [levainStartAt]);

  function shiftReadyBy(minutes: number) {
    setReadyBy((prev) => new Date(prev.getTime() + minutes * 60 * 1000));
  }

  function shiftLevainStart(minutes: number) {
    setLevainStartAt((prev) => {
      if (!prev) return prev;

      const now = Date.now();
      const maxStart = now - 60 * 1000;
      const minStart = now - 48 * 60 * 60 * 1000;
      const candidate = prev.getTime() + minutes * 60 * 1000;
      const clamped = Math.max(minStart, Math.min(maxStart, candidate));

      return new Date(clamped);
    });
  }

  function nextOccurrence(hour: number, minute: number): Date {
    const now = new Date();
    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  function toggleAdvanced() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAdvanced((prev) => !prev);
  }

  function toggleStepsDetails() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowStepsDetails((prev) => !prev);
  }

  function toggleEditInputs() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEditInputs((prev) => !prev);
  }

  async function clearPlannerReminders(ids?: string[]) {
    const toCancel = ids ?? reminderIdsRef.current;
    if (toCancel.length === 0) return;
    for (const id of toCancel) {
      try {
        await cancelScheduledNotification(id);
      } catch (error) {
        console.error('Failed to cancel scheduled reminder:', error);
      }
    }
    reminderIdsRef.current = [];
    setReminderIds([]);
  }

  async function schedulePlannerRemindersFor(
    startAt: Date,
    peakWindowStartAt: Date
  ): Promise<ReminderScheduleResult> {
    const now = Date.now();
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('Notifications are off', 'Enable notifications in iOS Settings.');
      return 'cancel';
    }

    const starterName = selectedStarter?.name ? ` for ${selectedStarter.name}` : '';
    const ids: string[] = [];

    if (startAt.getTime() > now) {
      ids.push(
        await scheduleOneTimeNotification({
          title: 'Start your levain now',
          body: `Time to begin your levain${starterName}.`,
          date: startAt,
          data: { starterId: selectedStarter?.id, type: 'levain-start' },
        })
      );
    }

    if (peakWindowStartAt.getTime() > now) {
      ids.push(
        await scheduleOneTimeNotification({
          title: 'Levain is entering its peak window',
          body: selectedStarter?.name
            ? `${selectedStarter.name} is entering peak window.`
            : 'Your levain is entering peak window.',
          date: peakWindowStartAt,
          data: { starterId: selectedStarter?.id, type: 'levain-peak-window' },
        })
      );
    }

    reminderIdsRef.current = ids;
    setReminderIds(ids);
    return 'scheduled';
  }

  async function schedulePeakWindowReminderFor(
    peakWindowStartAt: Date
  ): Promise<ReminderScheduleResult> {
    const now = Date.now();
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('Notifications are off', 'Enable notifications in iOS Settings.');
      return 'cancel';
    }

    const ids: string[] = [];
    if (peakWindowStartAt.getTime() > now) {
      ids.push(
        await scheduleOneTimeNotification({
          title: 'Levain is entering its peak window',
          body: selectedStarter?.name
            ? `${selectedStarter.name} is entering peak window.`
            : 'Your levain is entering peak window.',
          date: peakWindowStartAt,
          data: { starterId: selectedStarter?.id, type: 'levain-peak-window' },
        })
      );
    }

    if (ids.length === 0) {
      reminderIdsRef.current = [];
      setReminderIds([]);
      return 'cancel';
    }

    reminderIdsRef.current = ids;
    setReminderIds(ids);
    return 'scheduled';
  }

  async function schedulePlannerReminders(): Promise<ReminderScheduleResult> {
    const now = Date.now();
    if (plan.start_at.getTime() <= now) {
      const action = await new Promise<ReminderScheduleResult>((resolve) => {
        Alert.alert(
          'Ready by is too soon',
          `This culture typically peaks in ~${plan.estimated_peak_hours}h. Earliest ready time is ${formatClock(earliestReadyBy)}.`,
          [
            {
              text: 'Set earliest',
              onPress: () => {
                setReadyBy(new Date(earliestReadyBy));
                resolve('adjusted');
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve('cancel'),
            },
          ]
        );
      });
      return action;
    }

    return schedulePlannerRemindersFor(plan.start_at, peakWindowStart);
  }

  async function handleToggleRemindMe(value: boolean) {
    if (!value) {
      setRemindMe(false);
      try {
        await clearPlannerReminders();
      } catch (error) {
        console.error('Failed to cancel reminders:', error);
      }
      return;
    }
    setRemindMe(true);
  }

  useEffect(() => {
    if (!remindMe) return;
    if (skipNextReminderSyncRef.current) {
      skipNextReminderSyncRef.current = false;
      return;
    }

    let active = true;
    (async () => {
      try {
        await clearPlannerReminders();
        if (!active) return;
        const result = await schedulePlannerReminders();
        if (!active) return;
        if (result === 'cancel') {
          setRemindMe(false);
        }
      } catch (error) {
        console.error('Failed to schedule planner reminders:', error);
        if (active) {
          Alert.alert('Could not set reminders');
          setRemindMe(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    remindMe,
    plan.start_at.getTime(),
    peakWindowStart.getTime(),
    selectedStarter?.id,
    selectedStarter?.name,
  ]);

  async function handleAddToTimeline() {
    if (!selectedStarter || !hasValidInputs || saving || isStarterLocked) return;

    setSaving(true);
    try {
      const summary = `Levain plan: ${plan.starter_g}g starter, ${plan.flour_g}g flour, ${plan.water_g}g water (${plan.ratio_string}). Start at ${formatClock(plan.start_at)}, ready by ${formatClock(plan.ready_by)}.`;

      await createEvent({
        starter_id: selectedStarter.id,
        type: 'NOTE',
        timestamp: plan.start_at.toISOString(),
        notes: summary,
      });

      setSavedBannerMessage('Added to timeline');
      setShowSavedBanner(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save levain plan:', error);
      }
      setSavedBannerMessage('Couldn’t add to timeline');
      setShowSavedBanner(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleSmartStartNow() {
    if (!selectedStarter || !hasValidInputs || isStarterLocked) return;

    const actualStart = new Date();
    const startDiffMs = Math.abs(actualStart.getTime() - plan.start_at.getTime());
    const shouldAdjust = startDiffMs > 10 * 60 * 1000;
    const adjustedReadyBy = new Date(
      actualStart.getTime() + plan.estimated_peak_hours * 60 * 60 * 1000
    );
    const targetReadyBy = shouldAdjust ? adjustedReadyBy : plan.ready_by;
    const peakWindowStartAt = new Date(targetReadyBy.getTime() - 30 * 60 * 1000);
    const startIso = actualStart.toISOString();
    const readyByIso = targetReadyBy.toISOString();

    setSaving(true);
    try {
      await createEvent({
        starter_id: selectedStarter.id,
        type: 'NOTE',
        timestamp: startIso,
        notes: `LEV_START|${startIso}|READY_BY|${readyByIso}\nLevain started at ${formatClock(actualStart)}. Target ready by ${formatClock(targetReadyBy)}.`,
      });

      if (shouldAdjust) {
        skipNextReminderSyncRef.current = true;
        setReadyBy(targetReadyBy);
      }
      setLevainStartAt(actualStart);
      setPeakConfirmedAt(null);

      let remindersUpdated = false;
      if (isPro && remindMe) {
        try {
          await clearPlannerReminders();
          const reminderResult = await schedulePeakWindowReminderFor(peakWindowStartAt);
          if (reminderResult === 'cancel') {
            setRemindMe(false);
          } else if (reminderResult === 'scheduled') {
            remindersUpdated = true;
          }
        } catch (error) {
          console.error('Failed to update reminders after smart start:', error);
          Alert.alert('Could not update reminders');
        }
      }

      setSavedBannerMessage(
        remindersUpdated && reminderIdsRef.current.length > 0
          ? 'Levain started. Reminders updated.'
          : 'Levain started.'
      );
      setShowSavedBanner(true);
    } catch (error) {
      console.error('Failed to log smart start:', error);
      Alert.alert('Could not log levain start');
    } finally {
      setSaving(false);
    }
  }

  async function handlePeakConfirmNow() {
    if (!selectedStarter || !levainStartAt || isStarterLocked) return;

    const now = new Date();
    const elapsedMs = now.getTime() - levainStartAt.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    if (elapsedHours < 0.25) {
      Alert.alert(
        'Too soon to peak',
        `You're only ${Math.round(elapsedMinutes)}m since start. Typical peak is ~${plan.estimated_peak_hours}h.`,
        [
          { text: 'I started earlier…', onPress: () => shiftLevainStart(-30) },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    if (elapsedHours > 48) {
      Alert.alert(
        'Peak time looks invalid',
        `You're at ${elapsedHours.toFixed(2)}h since start, which is outside a realistic peak window.`
      );
      return;
    }

    const roundedHours = Math.round(elapsedHours * 100) / 100;
    const peakIso = now.toISOString();
    const planRatio = plan.ratio_string?.trim();
    const computedRatio =
      plan.starter_g > 0
        ? `1:${(plan.flour_g / plan.starter_g).toFixed(1)}:${(plan.water_g / plan.starter_g).toFixed(1)}`
        : null;
    const peakRatioString = planRatio && planRatio.length > 0 ? planRatio : computedRatio;

    setSaving(true);
    try {
      await createEvent({
        starter_id: selectedStarter.id,
        type: 'NOTE',
        timestamp: peakIso,
        ratio_string: peakRatioString ?? undefined,
        peak_confirmed_hours: roundedHours,
        notes: `LEV_PEAK|${peakIso}|HOURS|${roundedHours}${peakRatioString ? `|RATIO|${peakRatioString}` : ''}`,
      });

      const updatedBaseline = getUpdatedBaselinePeakHours(
        selectedStarter.baseline_peak_hours,
        roundedHours
      );
      await updateStarter(selectedStarter.id, { baseline_peak_hours: updatedBaseline });
      await refreshStarters();
      setPeakConfirmedAt(now);

      setSavedBannerMessage(
        `Peak confirmed at ${roundedHours}h. Baseline updated to ${updatedBaseline}h.`
      );
      setShowSavedBanner(true);

    } catch (error) {
      console.error('Failed to confirm peak:', error);
      Alert.alert('Could not save peak confirmation');
    } finally {
      setSaving(false);
    }
  }

  async function endActiveSession(startAt: Date, bannerMessage: string | null = 'Levain session ended.') {
    if (!selectedStarter) return;
    const now = new Date();
    await createEvent({
      starter_id: selectedStarter.id,
      type: 'NOTE',
      timestamp: now.toISOString(),
      notes: `LEV_END|${now.toISOString()}|START|${startAt.toISOString()}`,
    });
    setLevainStartAt(null);
    setPeakConfirmedAt(null);
    if (bannerMessage) {
      setSavedBannerMessage(bannerMessage);
      setShowSavedBanner(true);
    }
  }

  function handleEndSession() {
    if (!selectedStarter || !levainStartAt || isStarterLocked) return;
    Alert.alert('End levain session?', 'This clears the levain session but keeps Timeline history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End session',
        onPress: async () => {
          try {
            await endActiveSession(levainStartAt);
          } catch (error) {
            console.error('Failed to end levain session:', error);
            Alert.alert('Could not end session');
          }
        },
      },
    ]);
  }

  function getStepStatusColor(status: 'done' | 'now' | 'ready' | 'pending') {
    if (status === 'done' || status === 'ready') return theme.colors.success;
    if (status === 'now') return theme.colors.primary;
    return theme.colors.textSecondary;
  }

  function getStepsSummary(): string {
    if (coachPhase === 'ready_now') return 'Ready now';
    if (coachPhase === 'not_started') return `Next: Start at ${formatClock(plan.start_at)}`;
    if (coachPhase === 'confirmed') {
      return isReadyNow
        ? 'Ready now'
        : `Next: Ready by ${formatClock(plan.ready_by)}`;
    }
    if (coachPhase === 'in_peak_window') return `Next: Window ends at ${formatClock(peakWindowEnd)}`;
    if (coachPhase === 'past_peak_window') return `Next: Ready by ${formatClock(plan.ready_by)}`;
    if (coachPhase === 'warming_up') return `Next: Peak window at ${formatClock(peakWindowStart)}`;
    return 'On track';
  }

  const statusMessage = useMemo(() => {
    if (coachPhase === 'not_started') return 'Not started yet.';
    if (coachPhase === 'confirmed') return 'Learning from this session.';
    if (coachPhase === 'in_peak_window') return 'In peak window - great time to use your levain.';
    if (coachPhase === 'past_peak_window') return 'Past peak window.';
    if (coachPhase === 'warming_up') return 'Warming up.';
    return 'Ready to use.';
  }, [coachPhase]);

  const statusNext = useMemo(() => {
    if (coachPhase === 'not_started') return `Start at ${formatClock(plan.start_at)}`;
    if (coachPhase === 'confirmed') {
      return isReadyNow ? 'Ready now' : `Ready by ${formatClock(plan.ready_by)}`;
    }
    if (coachPhase === 'in_peak_window') return `Window ends ${formatClock(peakWindowEnd)}`;
    if (coachPhase === 'past_peak_window') return `Ready by ${formatClock(plan.ready_by)}`;
    if (coachPhase === 'warming_up') return `Peak window starts ${formatClock(peakWindowStart)}`;
    return 'Use when recipe needs it';
  }, [coachPhase, isReadyNow, plan.start_at, plan.ready_by, peakWindowEnd, peakWindowStart]);

  const statusHelper = useMemo(() => {
    if (coachPhase === 'not_started') {
      return plan.start_at.getTime() <= nowTick
        ? 'Starting late - we’ll adjust your ready estimate.'
        : null;
    }
    if (coachPhase === 'confirmed') return `Elapsed: ${formatElapsed(activeElapsedMs)}`;
    if (coachPhase === 'in_peak_window') return isPro && remindMe ? 'We’ll notify you as you enter peak.' : null;
    if (coachPhase === 'past_peak_window') return 'If it still looks strong, confirming helps accuracy.';
    if (coachPhase === 'warming_up') return `Elapsed: ${formatElapsed(activeElapsedMs)}`;
    return `Elapsed: ${formatElapsed(activeElapsedMs)}`;
  }, [coachPhase, plan.start_at, nowTick, activeElapsedMs, isPro, remindMe]);

  function scrollToActiveLevain() {
    scrollRef.current?.scrollTo({
      y: Math.max(0, activeLevainAnchorY - 12),
      animated: true,
    });
  }

  async function applyPlanPreset(label: string, hour: number, minute: number) {
    if (!selectedStarter || isStarterLocked) return;

    const targetReadyBy = nextOccurrence(hour, minute);
    const targetStartAt = new Date(
      targetReadyBy.getTime() - estimatedPeakHours * 60 * 60 * 1000
    );
    const targetPeakWindowStart = new Date(targetReadyBy.getTime() - 30 * 60 * 1000);

    // Prevent the next readyBy-driven reminder sync from immediately replacing this preset schedule.
    skipNextReminderSyncRef.current = true;
    setReadyBy(targetReadyBy);
    skipNextReminderSyncRef.current = true;

    if (isPro && remindMe) {
      try {
        await clearPlannerReminders();
        const reminderResult = await schedulePlannerRemindersFor(
          targetStartAt,
          targetPeakWindowStart
        );
        if (reminderResult === 'cancel') {
          setRemindMe(false);
        }
      } catch (error) {
        console.error('Failed to schedule preset reminders:', error);
      }
    }

    setSavedBannerMessage(`Plan set for ${label}. Start at ${formatClock(targetStartAt)}.`);
    setShowSavedBanner(true);
  }

  function openPlanPresetPicker() {
    Alert.alert(
      'Plan for',
      'Choose when you want levain ready.',
      [
        ...READY_BY_PRESETS.map((preset) => ({
          text: preset.label,
          onPress: () => {
            void applyPlanPreset(preset.label, preset.hour, preset.minute);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  async function handleUseLevainNow() {
    if (!selectedStarter || isStarterLocked) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    try {
      await createEvent({
        starter_id: selectedStarter.id,
        type: 'NOTE',
        timestamp: nowIso,
        notes: `LEV_USE|${nowIso}|RECIPE|${recipeTrimmed.length > 0 ? recipeTrimmed : 'unknown'}`,
      });
      setSavedBannerMessage(
        isWithinPeakWindow ? 'Logged: levain used at peak.' : 'Logged: levain used.'
      );
      setShowSavedBanner(true);
    } catch (error) {
      console.error('Failed to log levain use:', error);
      Alert.alert('Could not log use');
    } finally {
      setSaving(false);
    }
  }

  async function handleUseLevainNowAndEndSession() {
    if (!selectedStarter || !levainStartAt || isStarterLocked) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    try {
      await createEvent({
        starter_id: selectedStarter.id,
        type: 'NOTE',
        timestamp: nowIso,
        notes: `LEV_USE|${nowIso}|RECIPE|${recipeTrimmed.length > 0 ? recipeTrimmed : 'unknown'}`,
      });
      await endActiveSession(levainStartAt, null);
      setSavedBannerMessage('Logged: used levain');
      setShowSavedBanner(true);
    } catch (error) {
      console.error('Failed to log levain use:', error);
      Alert.alert('Could not log use');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNotification30s() {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setSavedBannerMessage('Notifications are off. Enable in Settings.');
        setShowSavedBanner(true);
        return;
      }
      const date = new Date(Date.now() + 30 * 1000);
      await scheduleOneTimeNotification({
        title: 'StarterBuddy test',
        body: 'This is a 30-second test notification.',
        date,
        data: { type: 'planner-test' },
      });
      setSavedBannerMessage('Test notification scheduled for ~30s.');
      setShowSavedBanner(true);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to schedule test notification:', error);
      }
      setSavedBannerMessage('Could not schedule test notification.');
      setShowSavedBanner(true);
    }
  }

  if (starters.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Card>
          <Body style={{ color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            Create a starter first to use Levain Planner.
          </Body>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {showSavedBanner && (
        <Banner
          message={savedBannerMessage}
          variant="success"
          onDismiss={() => setShowSavedBanner(false)}
        />
      )}
      {starters.length > 1 ? (
        <View style={styles.section}>
          <Label style={styles.sectionLabel}>Culture</Label>
          <SegmentedControl
            options={starters.map((s) => s.name)}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
            onSelect={(index) => setSelectedStarterId(starters[index]?.id ?? null)}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Label style={styles.sectionLabel}>Culture</Label>
          <Card style={{ marginHorizontal: 0 }}>
            <Body>{starters[0].name}</Body>
          </Card>
          <Caption
            style={{
              textAlign: 'center',
              marginTop: 8,
              color: theme.colors.textMuted ?? theme.colors.textSecondary,
            }}
          >
            Add another culture from Home (+) to switch here.
          </Caption>
        </View>
      )}

      <View style={styles.section}>
        <Label style={styles.sectionLabel}>Ready by</Label>
        <Card style={[styles.readyByCard, { marginHorizontal: 0 }]}>
          <TouchableOpacity
            style={[styles.timeAdjustButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground }]}
            onPress={() => shiftReadyBy(-30)}
            activeOpacity={0.7}
          >
            <Caption style={{ color: theme.colors.textSecondary }}>-30m</Caption>
          </TouchableOpacity>

          <Body style={{ fontWeight: '600', fontSize: 22 }}>{formatClock(readyBy)}</Body>

          <TouchableOpacity
            style={[styles.timeAdjustButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground }]}
            onPress={() => shiftReadyBy(30)}
            activeOpacity={0.7}
          >
            <Caption style={{ color: theme.colors.textSecondary }}>+30m</Caption>
          </TouchableOpacity>
        </Card>
        <View style={styles.readyByPresetRow}>
          {READY_BY_PRESETS.map((preset) => {
            const isSelected =
              readyBy.getHours() === preset.hour &&
              readyBy.getMinutes() === preset.minute;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.readyByPresetChip,
                  {
                    backgroundColor: isSelected ? theme.colors.background : theme.colors.inputBackground,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radii.xl,
                  },
                ]}
                onPress={() => {
                  setReadyBy(nextOccurrence(preset.hour, preset.minute));
                }}
                activeOpacity={0.7}
              >
                <Caption style={{ color: isSelected ? theme.colors.primary : theme.colors.text }}>
                  {preset.label}
                </Caption>
              </TouchableOpacity>
            );
          })}
        </View>
        {!showAdvanced && (
          <Caption style={{ marginTop: 8, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            We&apos;ll suggest a start time based on your culture&apos;s peak.
          </Caption>
        )}
        {(plan.start_at.getTime() <= Date.now() || isPro) && (
          <Caption style={{ marginTop: 2, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            {`Earliest: ${formatClock(earliestReadyBy)}`}
          </Caption>
        )}
      </View>

      <Card style={{ marginHorizontal: 0, marginBottom: CARD_GAP, padding: CARD_PAD_COMPACT }}>
        <View style={[styles.stepsHeaderRow, { marginBottom: ROW_PAD_Y_COMPACT }]}>
          <Label>Session</Label>
          <TouchableOpacity onPress={toggleStepsDetails} activeOpacity={0.7}>
            <Caption style={{ color: theme.colors.primary, fontWeight: '600' }}>
              {showStepsDetails ? 'Hide' : 'Details'}
            </Caption>
          </TouchableOpacity>
        </View>
        <Body>{statusMessage}</Body>
        <Caption style={{ marginTop: 6, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
          {`Next: ${statusNext}`}
        </Caption>
        {recipeTrimmed.length > 0 && (
          <Caption style={{ marginTop: 4, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            {`Recipe: ${recipeTrimmed}`}
          </Caption>
        )}
        {coachPhase === 'not_started' && (
          <>
            <Button
              title="Start now"
              onPress={handleSmartStartNow}
              loading={saving}
              disabled={!hasValidInputs || isStarterLocked}
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
            <Button
              title="Plan for Breakfast/Lunch/Dinner"
              onPress={openPlanPresetPicker}
              disabled={!hasValidInputs || isStarterLocked}
              variant="secondary"
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
          </>
        )}
        {coachPhase === 'confirmed' && (
          <Button
            title="End session"
            onPress={handleEndSession}
            loading={saving}
            disabled={!selectedStarter || isStarterLocked}
            style={{ marginTop: ROW_PAD_Y_COMPACT }}
          />
        )}
        {coachPhase === 'in_peak_window' && (
          <>
            <Button
              title="Confirm peak"
              onPress={handlePeakConfirmNow}
              loading={saving}
              disabled={!selectedStarter || isStarterLocked}
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
            <Button
              title="Use now"
              onPress={handleUseLevainNow}
              loading={saving}
              disabled={!hasValidInputs || !selectedStarter || isStarterLocked}
              variant="secondary"
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
          </>
        )}
        {coachPhase === 'past_peak_window' && (
          <Button
            title="Confirm peak anyway"
            onPress={handlePeakConfirmNow}
            loading={saving}
            disabled={!selectedStarter || isStarterLocked}
            style={{ marginTop: ROW_PAD_Y_COMPACT }}
          />
        )}
        {coachPhase === 'warming_up' && (
          <>
            <Button
              title="End session"
              onPress={handleEndSession}
              loading={saving}
              disabled={!selectedStarter || isStarterLocked}
              variant="secondary"
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
            <TouchableOpacity
              onPress={() => {
                scrollToActiveLevain();
              }}
              activeOpacity={0.7}
              style={{ marginTop: ROW_PAD_Y_COMPACT, alignSelf: 'flex-start' }}
            >
              <Caption style={{ color: theme.colors.primary }}>Adjust start</Caption>
            </TouchableOpacity>
            <Caption style={{ marginTop: 6, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
              Tip: adjust start time below (-15m / -30m / -1h).
            </Caption>
          </>
        )}
        {coachPhase === 'ready_now' && (
          <>
            <Button
              title="End session"
              onPress={handleEndSession}
              loading={saving}
              disabled={!selectedStarter || isStarterLocked}
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
            <Button
              title="Use now"
              onPress={handleUseLevainNow}
              loading={saving}
              disabled={!hasValidInputs || !selectedStarter || isStarterLocked}
              variant="secondary"
              style={{ marginTop: ROW_PAD_Y_COMPACT }}
            />
          </>
        )}
        {statusHelper && (
          <Caption style={{ marginTop: ROW_PAD_Y_COMPACT, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            {statusHelper}
          </Caption>
        )}
        {!showStepsDetails && (
          <Caption style={{ marginTop: ROW_PAD_Y_COMPACT, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            {getStepsSummary()}
          </Caption>
        )}
        {!showStepsDetails && levainStartAt && (
          <Caption style={{ marginTop: ROW_PAD_Y_COMPACT, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            {`Elapsed: ${formatElapsed(activeElapsedMs)}`}
          </Caption>
        )}
        {showStepsDetails && (
          <>
            {!levainStartAt ? (
              <Caption style={{ marginTop: 6, marginBottom: ROW_PAD_Y, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                {`Not started yet. Start at ${formatClock(plan.start_at)}.`}
              </Caption>
            ) : peakConfirmedAt ? (
              <Caption style={{ marginTop: 6, marginBottom: ROW_PAD_Y, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                Learning from this session.
              </Caption>
            ) : isWithinPeakWindow ? (
              <View style={{ marginTop: 6, marginBottom: ROW_PAD_Y }}>
                <Banner
                  message="You're in the peak window — great time to use your levain."
                  variant="success"
                  actionLabel="Confirm peak"
                  onAction={handlePeakConfirmNow}
                />
              </View>
            ) : nowTick < peakWindowStart.getTime() ? (
              <Caption style={{ marginTop: 6, marginBottom: ROW_PAD_Y, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                {`Warming up. Peak window starts ${formatClock(peakWindowStart)}.`}
              </Caption>
            ) : nowTick > peakWindowEnd.getTime() && !isReadyNow ? (
              <Caption style={{ marginTop: 6, marginBottom: ROW_PAD_Y, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                Past peak window. If it still looks strong, confirm peak anyway.
              </Caption>
            ) : isReadyNow ? (
              <View style={{ marginTop: 6, marginBottom: ROW_PAD_Y }}>
                <Banner
                  message="Ready by time reached. Use when your recipe needs it."
                  variant="info"
                />
              </View>
            ) : null}

            <View style={[styles.stepRow, styles.stepRowNormal]}>
              <Caption style={{ color: theme.colors.textSecondary, width: 78 }}>Start</Caption>
              <Body style={styles.stepTime}>{formatClock(plan.start_at)}</Body>
              {(() => {
                const startStatus = levainStartAt ? 'done' : 'pending';
                return (
                  <View
                    style={[
                      styles.stepStatusPill,
                      {
                        backgroundColor: theme.colors.inputBackground,
                        borderColor: getStepStatusColor(startStatus),
                      },
                    ]}
                  >
                    <Caption style={{ color: getStepStatusColor(startStatus) }}>
                      {levainStartAt ? 'Done' : 'Pending'}
                    </Caption>
                  </View>
                );
              })()}
            </View>

            <View style={[styles.stepRow, styles.stepRowNormal]}>
              <Caption style={{ color: theme.colors.textSecondary, width: 78 }}>Peak window</Caption>
              <Body style={styles.stepTime}>{`${formatClock(peakWindowStart)} – ${formatClock(peakWindowEnd)}`}</Body>
              {(() => {
                const peakStatus = peakConfirmedAt ? 'done' : isWithinPeakWindow ? 'now' : 'pending';
                const peakLabel = peakConfirmedAt ? 'Confirmed' : isWithinPeakWindow ? 'Now' : 'Pending';
                return (
                  <View
                    style={[
                      styles.stepStatusPill,
                      {
                        backgroundColor: theme.colors.inputBackground,
                        borderColor: getStepStatusColor(peakStatus),
                      },
                    ]}
                  >
                    <Caption style={{ color: getStepStatusColor(peakStatus) }}>
                      {peakLabel}
                    </Caption>
                  </View>
                );
              })()}
            </View>

            <View style={[styles.stepRow, styles.stepRowNormal]}>
              <Caption style={{ color: theme.colors.textSecondary, width: 78 }}>Ready</Caption>
              <Body style={styles.stepTime}>{formatClock(plan.ready_by)}</Body>
              {(() => {
                const readyStatus = isReadyNow ? 'ready' : 'pending';
                return (
                  <View
                    style={[
                      styles.stepStatusPill,
                      {
                        backgroundColor: theme.colors.inputBackground,
                        borderColor: getStepStatusColor(readyStatus),
                      },
                    ]}
                  >
                    <Caption style={{ color: getStepStatusColor(readyStatus) }}>
                      {isReadyNow ? 'Ready' : 'Pending'}
                    </Caption>
                  </View>
                );
              })()}
            </View>
          </>
        )}
      </Card>

      {levainStartAt && (
        <TouchableOpacity onPress={toggleEditInputs} style={styles.editInputsToggle} activeOpacity={0.7}>
          <Caption style={{ color: theme.colors.primary, fontWeight: '600' }}>
            {showEditInputs ? 'Hide inputs' : 'Edit inputs'}
          </Caption>
        </TouchableOpacity>
      )}

      {(!levainStartAt || showEditInputs) && (
        <>
          <View style={styles.section}>
            <Label style={styles.sectionLabel}>Levain amount</Label>
            <TextInput
              label="Desired final amount"
              suffix="g"
              value={desiredTotal}
              onChangeText={setDesiredTotal}
              keyboardType="number-pad"
            />
            <TextInput
              label="Recipe (optional)"
              placeholder="e.g. Country loaf"
              value={recipeName}
              onChangeText={setRecipeName}
            />
          </View>

          <TouchableOpacity onPress={toggleAdvanced} style={styles.advancedToggle} activeOpacity={0.7}>
            <Caption style={{ color: theme.colors.primary, fontWeight: '600' }}>
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </Caption>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.section}>
              <TextInput
                label="Hydration"
                suffix="%"
                value={hydration}
                onChangeText={setHydration}
                keyboardType="number-pad"
              />
              <Label style={[styles.sectionLabel, { marginTop: 2 }]}>Ratio</Label>
              <View style={styles.ratioRow}>
                <View style={styles.ratioField}>
                  <TextInput
                    label="Starter"
                    value={ratioA}
                    onChangeText={setRatioA}
                    keyboardType="number-pad"
                    style={styles.ratioInput}
                  />
                </View>
                <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
                <View style={styles.ratioField}>
                  <TextInput
                    label="Flour"
                    value={ratioB}
                    onChangeText={setRatioB}
                    keyboardType="number-pad"
                    style={styles.ratioInput}
                  />
                </View>
                <Text style={[styles.ratioSep, { color: theme.colors.textSecondary }]}>:</Text>
                <View style={styles.ratioField}>
                  <TextInput
                    label="Water"
                    value={ratioC}
                    onChangeText={setRatioC}
                    keyboardType="number-pad"
                    style={styles.ratioInput}
                  />
                </View>
              </View>
            </View>
          )}
        </>
      )}

      <Card style={{ marginHorizontal: 0 }}>
        <Label style={{ marginBottom: 8 }}>Smart Start</Label>
        <Body>{`Suggested start: ${formatClock(plan.start_at)}`}</Body>
        {plan.start_at.getTime() <= Date.now() && (
          <Caption style={{ marginTop: 8, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            You&apos;re starting late - we&apos;ll adjust your ready time estimate.
          </Caption>
        )}
        <Button
          title="I'm starting now"
          onPress={handleSmartStartNow}
          loading={saving}
          disabled={!hasValidInputs || isStarterLocked}
          style={{ marginTop: 16 }}
        />
        {levainStartAt && (
          <View
            style={{ marginTop: 16 }}
            onLayout={(event) => setActiveLevainAnchorY(event.nativeEvent.layout.y)}
          >
            <Label style={{ marginBottom: 4 }}>Levain session</Label>
            <Body>{`Started at ${formatClock(levainStartAt)}`}</Body>
            <Caption style={{ marginTop: 4, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
              {`Elapsed: ${formatElapsed(activeElapsedMs)}`}
            </Caption>
            <View style={styles.levainAdjustRow}>
              <TouchableOpacity
                onPress={() => shiftLevainStart(-15)}
                style={styles.levainAdjustButton}
                activeOpacity={0.7}
              >
                <Caption style={{ color: theme.colors.primary }}>-15m</Caption>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftLevainStart(-30)}
                style={styles.levainAdjustButton}
                activeOpacity={0.7}
              >
                <Caption style={{ color: theme.colors.primary }}>-30m</Caption>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => shiftLevainStart(-60)}
                style={styles.levainAdjustButton}
                activeOpacity={0.7}
              >
                <Caption style={{ color: theme.colors.primary }}>-1h</Caption>
              </TouchableOpacity>
            </View>
            {activeElapsedMs > plan.estimated_peak_hours * 60 * 60 * 1000 && (
              <Caption style={{ marginTop: 4, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                Past typical peak - confirm if it&apos;s still strong.
              </Caption>
            )}
            {isWithinPeakWindow && (
              <Caption style={{ marginTop: 6, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                In peak window.
              </Caption>
            )}
            <Button
              title="Use now"
              onPress={handleUseLevainNowAndEndSession}
              loading={saving}
              disabled={!selectedStarter || isStarterLocked}
              style={{ marginTop: 16, marginBottom: 10 }}
            />
            <TouchableOpacity onPress={handleEndSession} activeOpacity={0.7} style={{ marginTop: 10, alignSelf: 'flex-end' }}>
              <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>End session</Caption>
            </TouchableOpacity>
            <Label style={{ marginBottom: 4 }}>Peak confirm</Label>
            <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
              Tap when your levain is at peak.
            </Caption>
            <Caption style={{ marginTop: 2, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
              {`For: ${selectedStarter?.name ?? 'Current culture'}`}
            </Caption>
            <Button
              title="It peaked now"
              onPress={handlePeakConfirmNow}
              loading={saving}
              disabled={!selectedStarter || isStarterLocked}
              variant="secondary"
              style={{ marginTop: 12 }}
            />
          </View>
        )}
      </Card>

      <Card style={{ marginHorizontal: 0, marginTop: CARD_GAP }}>
        <Label style={{ marginBottom: 12 }}>Plan</Label>
        <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary, marginBottom: 10 }}>
          Start at is when to mix your levain so it peaks by Ready by.
        </Caption>

        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Starter</Caption>
          <Body style={styles.planValue}>{plan.starter_g}g</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Flour</Caption>
          <Body style={styles.planValue}>{plan.flour_g}g</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Water</Caption>
          <Body style={styles.planValue}>{plan.water_g}g</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Estimated peak</Caption>
          <Body>{plan.estimated_peak_hours}h</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Peak confidence</Caption>
          <Body
            style={{
              color:
                peakConfidence === 'high'
                  ? theme.colors.success
                  : peakConfidence === 'medium'
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
            }}
          >
            {peakConfidence === 'high' ? 'High' : peakConfidence === 'medium' ? 'Medium' : 'Low'}
          </Body>
        </View>
        {peakConfidence === 'low' && (
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary, marginTop: -2, marginBottom: 6 }}>
            {levainStartAt
              ? 'Confirm peak once to boost confidence.'
              : 'Log a levain start + peak to improve confidence.'}
          </Caption>
        )}
        {peakConfidence === 'medium' && (
          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary, marginTop: -2, marginBottom: 6 }}>
            Confirm peak again to reach High confidence.
          </Caption>
        )}
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Peak window</Caption>
          <Body>{`${formatClock(peakWindowStart)} – ${formatClock(peakWindowEnd)}`}</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Start at</Caption>
          <Body>{formatClock(plan.start_at)}</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Ready by</Caption>
          <Body>{formatClock(plan.ready_by)}</Body>
        </View>
        <View style={styles.planRow}>
          <Caption style={{ color: theme.colors.textSecondary }}>Final ratio</Caption>
          <Body>{plan.ratio_string}</Body>
        </View>
      </Card>

      {isPro ? (
        <Card style={{ marginHorizontal: 0, marginTop: 12 }}>
          <View style={styles.reminderRow}>
            <Body>Reminders</Body>
            <View style={styles.reminderSwitchRow}>
              <Caption style={{ color: theme.colors.textSecondary, marginRight: 8 }}>Remind me</Caption>
              <Switch
                value={remindMe}
                onValueChange={handleToggleRemindMe}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              />
            </View>
          </View>
          <Caption style={{ marginTop: 10, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
            We&apos;ll remind you when to start and when your levain enters the peak window.
          </Caption>
          {__DEV__ && (
            <Button
              title="Test notification (30s)"
              onPress={handleTestNotification30s}
              variant="text"
              disabled={saving}
              style={{ marginTop: 8 }}
            />
          )}
          {reminderIds.length > 0 && (
            <Caption style={{ marginTop: 6, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
              {`Scheduled: ${reminderIds.length}`}
            </Caption>
          )}
        </Card>
      ) : null}

      <Button
        title="Add to Timeline"
        onPress={handleAddToTimeline}
        loading={saving}
        disabled={!hasValidInputs || saving || isStarterLocked}
        style={{ marginTop: SECTION_GAP }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  content: {
    padding: SCREEN_HPAD,
  },
  section: {
    marginBottom: SECTION_GAP,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  ratioField: {
    flex: 1,
    minWidth: 80,
    flexShrink: 1,
  },
  ratioSep: {
    fontSize: 18,
    marginBottom: 24,
    fontWeight: '300',
    marginHorizontal: 2,
  },
  ratioInput: {
    minHeight: 46,
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    textAlign: 'left',
    flexShrink: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  advancedToggle: {
    alignSelf: 'flex-end',
    marginTop: ROW_PAD_Y_COMPACT,
    marginBottom: SECTION_GAP,
  },
  editInputsToggle: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 14,
  },
  readyByCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readyByPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  readyByPresetChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeAdjustButton: {
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ROW_PAD_Y_COMPACT,
  },
  planValue: {
    fontWeight: '600',
    textAlign: 'right',
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levainAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  levainAdjustButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepRowNormal: {
    paddingVertical: ROW_PAD_Y_COMPACT,
  },
  stepTime: {
    flex: 1,
    marginRight: 8,
  },
  stepStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ROW_PAD_Y,
  },
});
