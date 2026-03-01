import React, { useCallback, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Animated, Pressable, Alert, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  createEvent,
  getActiveLevainSession,
  getLastFeedEvent,
  updateStarter,
} from '../../db';
import { Starter, StarterEvent } from '../../models/types';
import { getTimeUntilPeak, getPeakStatus, estimatePeakHoursFromRatio } from '../../utils/feedCalculations';
import { computeCoachPhase, getPlannerPeakHours } from '../../utils/levainPlanner';
import { ensureActiveStarterId } from '../../utils/activeStarter';
import { HomeStackParamList } from '../../navigation/types';
import { FRIDGE_INTERVAL_HOURS } from '../../constants/storage';
import { SCREEN_HPAD, SECTION_GAP, CARD_GAP, ROW_PAD_Y_COMPACT } from '../../theme/spacing';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeScreen'>;

interface StarterWithFeed extends Starter {
  lastFeed: StarterEvent | null;
  peakStatus: 'before' | 'within' | 'past' | 'dormant' | 'none';
  statusLine: string;
  levainSession?: { startAt: Date; readyBy: Date } | null;
  locked?: boolean;
}

export function HomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const [starters, setStarters] = useState<StarterWithFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [savingSessionActionId, setSavingSessionActionId] = useState<string | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const adOpacity = useRef(new Animated.Value(0)).current;
  const extra = Constants.expoConfig?.extra as
    | {
        admob?: {
          iosBannerUnitId?: string;
          androidBannerUnitId?: string;
        };
      }
    | undefined;
  const configuredAdUnitId =
    Platform.OS === 'ios'
      ? extra?.admob?.iosBannerUnitId
      : extra?.admob?.androidBannerUnitId;
  const adUnitId =
    __DEV__ && (!configuredAdUnitId || configuredAdUnitId.includes('REPLACE_ME'))
      ? TestIds.BANNER
      : !configuredAdUnitId || configuredAdUnitId.includes('REPLACE_ME')
      ? null
      : configuredAdUnitId;
  const isStarterLockedById = useCallback(
    (starterId: string) =>
      !isPro &&
      starters.length > 1 &&
      !!activeStarterId &&
      starterId !== activeStarterId,
    [activeStarterId, isPro, starters.length]
  );
  const openLockedCulturePaywall = useCallback(
    (placement: string) => {
      navigation.getParent()?.navigate(
        'ProPaywall' as any,
        {
          trigger: 'multi_culture_locked_action',
          placement,
          title: 'Manage multiple cultures',
          message: 'Pro unlocks all your cultures and lets you plan each one.',
        } as any
      );
    },
    [navigation]
  );

  const loadStarters = useCallback(async () => {
    try {
      const {
        starters: allStarters,
        starterCount,
        activeStarterId: nextActiveStarterId,
      } = await ensureActiveStarterId(isPro);

      setActiveStarterIdState(nextActiveStarterId ?? null);

      const enriched: StarterWithFeed[] = await Promise.all(
        allStarters.map(async (s) => {
          const lastFeed = await getLastFeedEvent(s.id);
          const levainSession = await getActiveLevainSession(s.id);
          let peakStatus: StarterWithFeed['peakStatus'] = 'none';
          let statusLine = 'No feedings recorded';

          if (s.storage_mode === 'fridge' && !lastFeed) {
            peakStatus = 'dormant';
            statusLine = 'Dormant (fridge)';
          } else if (lastFeed) {
            const estimatedPeak = estimatePeakHoursFromRatio(
              s.preferred_ratio_a,
              s.preferred_ratio_b,
              s.baseline_peak_hours
            );

            if (s.storage_mode === 'fridge') {
              peakStatus = 'dormant';
              statusLine = 'Dormant (fridge)';
            } else {
              peakStatus = getPeakStatus(lastFeed.timestamp, estimatedPeak);
              if (peakStatus === 'within') {
                statusLine = 'Within optimal window';
              } else if (peakStatus === 'past') {
                statusLine = 'Past optimal window';
              } else {
                statusLine = getTimeUntilPeak(lastFeed.timestamp, estimatedPeak);
              }
            }
          }

          const isLocked =
            !isPro && starterCount > 1 && !!nextActiveStarterId && s.id !== nextActiveStarterId;
          return { ...s, lastFeed, peakStatus, statusLine, levainSession, locked: isLocked };
        })
      );
      setStarters(enriched);
    } catch (e) {
      console.error('Failed to load starters:', e);
    } finally {
      setLoading(false);
    }
  }, [isPro]);

  useFocusEffect(
    useCallback(() => {
      loadStarters();
    }, [loadStarters])
  );

  useEffect(() => {
    if (adLoaded) {
      Animated.timing(adOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      return;
    }
    adOpacity.setValue(0);
  }, [adLoaded, adOpacity]);

  useEffect(() => {
    if (isPro || adUnitId == null) {
      setAdLoaded(false);
      adOpacity.setValue(0);
    }
  }, [isPro, adUnitId, adOpacity]);

  function handleAddStarter() {
    if (!isPro && starters.length >= 1) {
      openLockedCulturePaywall('home_add_starter');
      return;
    }
    navigation.navigate('EditStarter', { mode: 'create' });
  }

  function handleChillStarter(starter: StarterWithFeed) {
    if (isStarterLockedById(starter.id)) return;
    Alert.alert(
      'Move to fridge?',
      `Move ${starter.name} to the fridge?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
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
              await loadStarters();
              Alert.alert('Moved to fridge', 'Feeding interval set to 7 days.');
            } catch (e) {
              console.error('Failed to move starter to fridge:', e);
              Alert.alert('Could not move to fridge');
            }
          },
        },
      ]
    );
  }

  function getLastFedString(event: StarterEvent | null): string {
    if (!event) return 'Never fed';
    const feedDate = new Date(event.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - feedDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) return `Fed ${Math.round(diffHours * 60)}m ago`;
    if (diffHours < 24) return `Fed ${Math.round(diffHours)}h ago`;
    const days = Math.floor(diffHours / 24);
    return `Fed ${days}d ago`;
  }

  function formatElapsed(ms: number): string {
    const totalMinutes = Math.max(0, Math.floor(ms / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  function openPlannerOrPaywall() {
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

  async function logLevainUseNow(starterId: string, recipe: string = 'unknown') {
    if (isStarterLockedById(starterId)) return;
    setSavingSessionActionId(starterId);
    const nowIso = new Date().toISOString();
    try {
      await createEvent({
        starter_id: starterId,
        type: 'NOTE',
        timestamp: nowIso,
        notes: `LEV_USE|${nowIso}|RECIPE|${recipe}`,
      });
      await loadStarters();
    } catch (e) {
      console.error('Failed to log levain use:', e);
      Alert.alert('Could not log use');
    } finally {
      setSavingSessionActionId(null);
    }
  }

  function promptLevainUseNow(starterId: string) {
    if (savingSessionActionId || isStarterLockedById(starterId)) return;

    const quickChoices = ['No recipe', 'Country loaf', 'Pizza', 'Baguette'];
    const saveChoice = (value: string) => {
      const normalized = value.trim();
      void logLevainUseNow(
        starterId,
        normalized.length > 0 && normalized.toLowerCase() !== 'no recipe'
          ? normalized
          : 'unknown'
      );
    };

    if (Platform.OS === 'ios' && typeof (Alert as any).prompt === 'function') {
      (Alert as any).prompt(
        'Use now',
        'Recipe (optional)',
        [
          ...quickChoices.map((choice) => ({
            text: choice,
            onPress: () => saveChoice(choice),
          })),
          {
            text: 'Other…',
            onPress: () => {
              (Alert as any).prompt(
                'Custom recipe',
                undefined,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Save',
                    onPress: (value?: string) => saveChoice(value ?? ''),
                  },
                ],
                'plain-text'
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    Alert.alert(
      'Use now',
      'Select recipe',
      [
        ...quickChoices.map((choice) => ({
          text: choice,
          onPress: () => saveChoice(choice),
        })),
        {
          text: 'Other (logs unknown)',
          onPress: () => saveChoice('unknown'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  async function logLevainEndSession(starterId: string, startAtIso: string) {
    if (isStarterLockedById(starterId)) return;
    setSavingSessionActionId(starterId);
    const nowIso = new Date().toISOString();
    try {
      await createEvent({
        starter_id: starterId,
        type: 'NOTE',
        timestamp: nowIso,
        notes: `LEV_END|${nowIso}|START|${startAtIso}`,
      });
      await loadStarters();
    } catch (e) {
      console.error('Failed to log levain end:', e);
      Alert.alert('Could not end session');
    } finally {
      setSavingSessionActionId(null);
    }
  }

  const isSingle = starters.length === 1;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleAddStarter} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Ionicons name="add-circle-outline" size={26} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, theme.colors.primary, starters.length, isPro]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Caption style={{ textAlign: 'center', marginTop: 2, marginBottom: CARD_GAP, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
        Your cultures
      </Caption>

      {/* Peak banners */}
      {starters
        .filter((s) => s.peakStatus === 'within')
        .map((s) => (
          <Banner
            key={`peak-${s.id}`}
            message="Your culture may be ready."
            actionLabel={s.locked ? 'Upgrade' : 'Confirm'}
            variant="warning"
            onAction={() =>
              s.locked
                ? openLockedCulturePaywall('home_peak_banner')
                : navigation.navigate('ConfirmPeak', {
                    starterId: s.id,
                    starterName: s.name,
                  })
            }
          />
        ))}

      {/* Starter cards */}
      {starters.map((starter) => {
        const isLocked = !!starter.locked;
        const lastFed = getLastFedString(starter.lastFeed);
        const metaLine =
          lastFed === 'Never fed'
            ? `Never fed · ${starter.hydration_target}% hydration`
            : `Last fed ${lastFed} · ${starter.hydration_target}% hydration`;
        const nowMs = Date.now();
        const sessionInfo = starter.levainSession
          ? computeCoachPhase({
              now: nowMs,
              startAt: starter.levainSession.startAt,
              readyBy: starter.levainSession.readyBy,
              estimatedPeakHours: getPlannerPeakHours(starter),
            })
          : null;
        const sessionElapsed = starter.levainSession
          ? formatElapsed(nowMs - starter.levainSession.startAt.getTime())
          : null;

        return (
          <TouchableOpacity
            key={starter.id}
            activeOpacity={0.8}
            onPress={() =>
              isLocked
                ? openLockedCulturePaywall('home_card')
                : navigation.navigate('StarterDetail', { starterId: starter.id })
            }
          >
            <Card
              style={
                isSingle
                  ? { marginVertical: CARD_GAP, paddingVertical: 24 }
                  : undefined
              }
            >
              <View style={[styles.cardInner, isLocked && styles.cardInnerLocked]}>
                <View style={styles.cardHeader}>
                  <Heading style={{ fontSize: isSingle ? 22 : 20 }}>{starter.name}</Heading>
                  {isLocked ? (
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color={theme.colors.textMuted ?? theme.colors.textSecondary}
                    />
                  ) : starter.peakStatus === 'within' ? (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('ConfirmPeak', {
                          starterId: starter.id,
                          starterName: starter.name,
                        })
                      }
                    >
                      <Caption style={{ color: theme.colors.accent }}>Confirm Peak</Caption>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Body
                  style={{
                    color:
                      starter.peakStatus === 'within'
                        ? theme.colors.accent
                        : starter.peakStatus === 'past'
                        ? theme.colors.danger
                        : theme.colors.textSecondary,
                    marginTop: 2,
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  {starter.statusLine}
                </Body>

                {isLocked && (
                  <View style={styles.lockHintRow}>
                    <Caption style={{ color: theme.colors.textSecondary }}>
                      Multiple cultures are a Pro feature.
                    </Caption>
                    <TouchableOpacity onPress={() => openLockedCulturePaywall('home_lock_hint_upgrade')}>
                      <Caption style={{ color: theme.colors.primary }}>Upgrade</Caption>
                    </TouchableOpacity>
                  </View>
                )}

                {!starter.levainSession && (
                  <View style={styles.sessionStrip}>
                  <TouchableOpacity
                    style={styles.sessionSecondary}
                    onPress={() =>
                      isLocked
                        ? openLockedCulturePaywall('home_session_build_levain')
                        : openPlannerOrPaywall()
                    }
                  >
                    <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                      {isPro ? 'Build levain' : 'Build levain (Pro)'}
                    </Caption>
                  </TouchableOpacity>
                  </View>
                )}

                {starter.levainSession && sessionInfo && (
                  <View style={styles.sessionStrip}>
                    <View style={styles.sessionRow}>
                      <Caption style={{ color: theme.colors.textSecondary }}>
                        {`Levain session • ${sessionElapsed ?? '0m'}`}
                      </Caption>
                      <View
                        style={[
                          styles.sessionPill,
                          {
                            borderColor:
                              sessionInfo.phase === 'in_peak_window'
                                ? theme.colors.primary
                                : sessionInfo.phase === 'ready_now'
                                ? theme.colors.success
                                : theme.colors.border,
                            backgroundColor: theme.colors.inputBackground,
                          },
                        ]}
                      >
                        <Caption
                          style={{
                            color:
                              sessionInfo.phase === 'in_peak_window'
                                ? theme.colors.primary
                                : sessionInfo.phase === 'ready_now'
                                ? theme.colors.success
                                : theme.colors.textSecondary,
                          }}
                        >
                          {sessionInfo.statusLabel}
                        </Caption>
                      </View>
                    </View>
                    {sessionInfo.phase === 'warming_up' && (
                      <Button
                        title="Adjust start"
                        onPress={() =>
                          isLocked
                            ? openLockedCulturePaywall('home_session_adjust_start')
                            : openPlannerOrPaywall()
                        }
                        disabled={savingSessionActionId === starter.id}
                        style={{ marginTop: ROW_PAD_Y_COMPACT }}
                      />
                    )}
                    {sessionInfo.phase === 'in_peak_window' && (
                      <>
                        <Button
                        title="Use now"
                        onPress={() =>
                          isLocked
                            ? openLockedCulturePaywall('home_session_use_now')
                            : promptLevainUseNow(starter.id)
                        }
                        disabled={savingSessionActionId === starter.id}
                        loading={savingSessionActionId === starter.id}
                        style={{ marginTop: ROW_PAD_Y_COMPACT }}
                      />
                        <TouchableOpacity
                          style={styles.sessionSecondary}
                          disabled={savingSessionActionId === starter.id}
                          onPress={() =>
                            isLocked
                              ? openLockedCulturePaywall('home_session_confirm_peak')
                              : openPlannerOrPaywall()
                          }
                        >
                          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                            Confirm peak
                          </Caption>
                        </TouchableOpacity>
                      </>
                    )}
                    {sessionInfo.phase === 'ready_now' && (
                      <>
                        <Button
                        title="Use now"
                        onPress={() =>
                          isLocked
                            ? openLockedCulturePaywall('home_session_use_now')
                            : promptLevainUseNow(starter.id)
                        }
                        disabled={savingSessionActionId === starter.id}
                        loading={savingSessionActionId === starter.id}
                        style={{ marginTop: ROW_PAD_Y_COMPACT }}
                      />
                        <TouchableOpacity
                          style={styles.sessionSecondary}
                          disabled={savingSessionActionId === starter.id}
                          onPress={() =>
                            isLocked
                              ? openLockedCulturePaywall('home_session_end')
                              : logLevainEndSession(
                                  starter.id,
                                  starter.levainSession?.startAt.toISOString() ?? new Date().toISOString()
                                )
                          }
                        >
                          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                            End session
                          </Caption>
                        </TouchableOpacity>
                      </>
                    )}
                    {sessionInfo.phase === 'past_peak_window' && (
                      <>
                        <Button
                        title="Use now"
                        onPress={() =>
                          isLocked
                            ? openLockedCulturePaywall('home_session_use_now')
                            : promptLevainUseNow(starter.id)
                        }
                        disabled={savingSessionActionId === starter.id}
                        loading={savingSessionActionId === starter.id}
                        style={{ marginTop: ROW_PAD_Y_COMPACT }}
                      />
                        <TouchableOpacity
                          style={styles.sessionSecondary}
                          disabled={savingSessionActionId === starter.id}
                          onPress={() =>
                            isLocked
                              ? openLockedCulturePaywall('home_session_confirm_peak')
                              : openPlannerOrPaywall()
                          }
                        >
                          <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                            Confirm peak
                          </Caption>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                <View style={styles.cardMeta}>
                  <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                    {metaLine}
                  </Caption>
                </View>

                <View style={styles.cardActions}>
                  <Button
                    title="Feed"
                    onPress={() =>
                      isLocked
                        ? openLockedCulturePaywall('home_action_feed')
                        : navigation.navigate('FeedWizard', { starterId: starter.id })
                    }
                    style={{ flex: 1, marginTop: 16, marginBottom: 10 }}
                  />
                  <View style={styles.secondaryActions}>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() =>
                        isLocked
                          ? openLockedCulturePaywall('home_action_build_levain')
                          : navigation.navigate('FeedWizard', { starterId: starter.id, goal: 'Build Levain' })
                      }
                    >
                      <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Use</Caption>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() =>
                        isLocked ? openLockedCulturePaywall('home_action_chill') : handleChillStarter(starter)
                      }
                    >
                      <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Chill</Caption>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() =>
                        isLocked
                          ? openLockedCulturePaywall('home_action_log_note')
                          : navigation.navigate('StarterDetail', { starterId: starter.id })
                      }
                    >
                      <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary }}>Log Note</Caption>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}

      {/* Ad banner placeholder for free users */}
      {!isPro && starters.length > 0 && adUnitId && (
        <Animated.View style={[styles.adContainer, { borderRadius: theme.radii.xl, backgroundColor: theme.colors.inputBackground }]}>
          <Caption style={{ textAlign: 'center', color: theme.colors.textMuted ?? theme.colors.textSecondary, marginBottom: 8 }}>
            Starter Kit supported by ads
          </Caption>
          <Animated.View style={{ opacity: adOpacity }}>
            <BannerAd
              unitId={adUnitId}
              size={BannerAdSize.BANNER}
              onAdLoaded={() => setAdLoaded(true)}
              onAdFailedToLoad={(error) => {
                setAdLoaded(false);
                if (__DEV__) {
                  console.error('Ad failed to load:', error);
                }
              }}
            />
          </Animated.View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SCREEN_HPAD,
    paddingTop: ROW_PAD_Y_COMPACT,
    paddingBottom: 32,
    justifyContent: 'flex-start',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInner: {
    opacity: 1,
  },
  cardInnerLocked: {
    opacity: 0.65,
  },
  lockHintRow: {
    marginTop: ROW_PAD_Y_COMPACT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    marginTop: ROW_PAD_Y_COMPACT,
    marginBottom: 6,
  },
  sessionStrip: {
    marginTop: ROW_PAD_Y_COMPACT,
    paddingTop: ROW_PAD_Y_COMPACT,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sessionSecondary: {
    marginTop: ROW_PAD_Y_COMPACT,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  cardActions: {
    marginTop: 0,
    flexDirection: 'column',
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: ROW_PAD_Y_COMPACT,
  },
  secondaryActionButton: {
    marginHorizontal: SECTION_GAP / 2,
    paddingVertical: 6,
  },
  adContainer: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 70,
  },
});
