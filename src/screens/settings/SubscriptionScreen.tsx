import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Subheading, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PurchasesPackage } from 'react-native-purchases';
import { getAllEvents, getAllStarters } from '../../db';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import type { RouteProp } from '@react-navigation/native';
import { maybeShowProPaywall } from '../../services/proTriggers';
import {
  computeYearlyValueSignal,
  getPackageTypeKey,
  hasActiveEntitlement,
  isPurchaseCanceledError,
  pickMonthlyAndYearlyPackages,
} from '../../utils/subscriptionPaywall';
import {
  computeConversionChecks,
  getFunnelSnapshot,
  resetFunnel,
  trackFunnel,
  type FunnelSnapshot,
} from '../../services/upgradeFunnel';

const BENEFITS = [
  'Manage multiple cultures',
  'Peak trend + best ratios + consistency insights',
  'Advanced peak modeling and better forecasts',
  'Levain planner reminders and peak alerts',
  'Ad-free',
];
const PRIVACY_URL = 'https://azielke8.github.io/starter-buddy-support/privacy.html';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export function SubscriptionScreen() {
  const PAYWALL_VARIANT = 'v1';
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProPaywall'>>();
  const { isPro, offerings, purchase, restore } = useSubscription();
  const isProRef = useRef(isPro);
  const [loadingPackageId, setLoadingPackageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [starterCount, setStarterCount] = useState(0);
  const [hasAnalyticsData, setHasAnalyticsData] = useState(false);
  const [billingIndex, setBillingIndex] = useState(1);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: 'info' | 'success' | 'warning';
  } | null>(null);
  const [lastGuardReturn, setLastGuardReturn] = useState<'none' | 'purchase' | 'restore'>('none');
  const [funnelSnapshot, setFunnelSnapshot] = useState<FunnelSnapshot | null>(null);
  const triggerContext = route.params;
  const SHOW_DEV_PAYWALL_DEBUG = __DEV__ && true;
  const paywallAttribution = useMemo(
    () => ({
      trigger: triggerContext?.trigger ?? null,
      placement: triggerContext?.placement ?? 'unknown',
    }),
    [triggerContext?.placement, triggerContext?.trigger]
  );

  const refreshFunnelSnapshot = useCallback(async () => {
    if (!SHOW_DEV_PAYWALL_DEBUG) return;
    const snapshot = await getFunnelSnapshot();
    setFunnelSnapshot(snapshot);
  }, [SHOW_DEV_PAYWALL_DEBUG]);

  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  useEffect(() => {
    void trackFunnel('paywall_opened', {
      ...paywallAttribution,
      paywallVariant: PAYWALL_VARIANT,
    });
    void refreshFunnelSnapshot();
  }, [PAYWALL_VARIANT, paywallAttribution, refreshFunnelSnapshot]);

  function isSuccessfulOutcome(result: unknown): boolean {
    if (hasActiveEntitlement(result)) return true;
    if (result === true) return true;
    return isProRef.current;
  }

  function getPackagePriceNumber(pkg: PurchasesPackage | null): number | null {
    if (!pkg) return null;
    const product = pkg.product as {
      price?: number;
      priceAmountMicros?: number;
    };
    if (typeof product.price === 'number' && Number.isFinite(product.price)) {
      return product.price;
    }
    if (typeof product.priceAmountMicros === 'number' && Number.isFinite(product.priceAmountMicros)) {
      return product.priceAmountMicros / 1_000_000;
    }
    return null;
  }

  useEffect(() => {
    let active = true;
    async function loadPersonalization() {
      try {
        const [starters, events] = await Promise.all([getAllStarters(), getAllEvents()]);
        if (!active) return;
        setStarterCount(starters.length);
        setHasAnalyticsData(
          events.some(
            (event) =>
              typeof event.peak_confirmed_hours === 'number' ||
              (event.notes?.startsWith('LEV_PEAK|') ?? false)
          )
        );
      } catch {
        if (!active) return;
        setStarterCount(0);
        setHasAnalyticsData(false);
      }
    }
    void loadPersonalization();
    return () => {
      active = false;
    };
  }, []);

  const { monthly: monthlyPackage, yearly: yearlyPackage } = useMemo(
    () => pickMonthlyAndYearlyPackages(offerings),
    [offerings]
  );

  useEffect(() => {
    if (monthlyPackage && !yearlyPackage) {
      setBillingIndex(0);
      return;
    }
    setBillingIndex(1);
  }, [monthlyPackage, yearlyPackage]);

  const selectedPackage = useMemo(() => {
    if (monthlyPackage && yearlyPackage) {
      return billingIndex === 0 ? monthlyPackage : yearlyPackage;
    }
    return yearlyPackage ?? monthlyPackage ?? offerings[0] ?? null;
  }, [billingIndex, monthlyPackage, offerings, yearlyPackage]);

  const monthlyPrice = useMemo(() => getPackagePriceNumber(monthlyPackage), [monthlyPackage]);
  const yearlyPrice = useMemo(() => getPackagePriceNumber(yearlyPackage), [yearlyPackage]);
  const yearlyValueSignal = useMemo(
    () => computeYearlyValueSignal(monthlyPrice, yearlyPrice),
    [monthlyPrice, yearlyPrice]
  );
  const yearlyMonthlyEquivalent = yearlyValueSignal.monthlyEquivalent ?? null;
  const yearlySavingsPercent = yearlyValueSignal.savePercent ?? null;
  const conversionChecks = useMemo(
    () => (funnelSnapshot ? computeConversionChecks(funnelSnapshot) : null),
    [funnelSnapshot]
  );

  function formatRate(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function getPackageLabel(pkg: PurchasesPackage): string {
    const packageType = String(pkg.packageType).toUpperCase();
    if (packageType.includes('ANNUAL')) return 'Yearly';
    if (packageType.includes('MONTHLY')) return 'Monthly';
    if (packageType.includes('WEEKLY')) return 'Weekly';
    if (packageType.includes('LIFETIME')) return 'Lifetime';
    return pkg.product.title || 'Plan';
  }

  async function handlePurchase(pkg: PurchasesPackage) {
    if (loadingPackageId !== null || restoring) {
      setLastGuardReturn('purchase');
      return;
    }
    setLastGuardReturn('none');
    setFeedback(null);
    setLoadingPackageId(pkg.identifier);
    try {
      await trackFunnel('start_purchase', {
        ...paywallAttribution,
        packageId: pkg.identifier,
        paywallVariant: PAYWALL_VARIANT,
      });
      const result = await purchase(pkg);
      const ok = isSuccessfulOutcome(result);
      if (ok) {
        await trackFunnel('purchase_success', {
          ...paywallAttribution,
          packageId: pkg.identifier,
          paywallVariant: PAYWALL_VARIANT,
        });
        await refreshFunnelSnapshot();
        return;
      }
      await trackFunnel('purchase_fail', {
        ...paywallAttribution,
        packageId: pkg.identifier,
        paywallVariant: PAYWALL_VARIANT,
      });
      setFeedback({ message: 'Could not complete purchase. Please try again.', variant: 'warning' });
    } catch (error) {
      if (isPurchaseCanceledError(error)) {
        await trackFunnel('purchase_cancel', {
          ...paywallAttribution,
          packageId: pkg.identifier,
          paywallVariant: PAYWALL_VARIANT,
        });
        setFeedback({ message: 'Purchase canceled.', variant: 'info' });
      } else {
        await trackFunnel('purchase_fail', {
          ...paywallAttribution,
          packageId: pkg.identifier,
          paywallVariant: PAYWALL_VARIANT,
        });
        if (__DEV__) {
          console.error('Purchase failed:', error);
        }
        setFeedback({ message: 'Could not complete purchase. Please try again.', variant: 'warning' });
      }
    } finally {
      setLoadingPackageId(null);
      await refreshFunnelSnapshot();
    }
  }

  async function handleRestore() {
    if (restoring || loadingPackageId !== null) {
      setLastGuardReturn('restore');
      return;
    }
    setLastGuardReturn('none');
    setFeedback(null);
    setRestoring(true);
    try {
      await trackFunnel('restore_started', {
        ...paywallAttribution,
        paywallVariant: PAYWALL_VARIANT,
      });
      const restored = await restore();
      const didRestore = hasActiveEntitlement(restored) || restored === true || isProRef.current;
      await trackFunnel(didRestore ? 'restore_success' : 'restore_none', {
        ...paywallAttribution,
        paywallVariant: PAYWALL_VARIANT,
      });
      setFeedback({
        message: didRestore ? 'Purchases restored.' : 'No previous purchases were found.',
        variant: didRestore ? 'success' : 'info',
      });
    } catch (error) {
      await trackFunnel('restore_fail', {
        ...paywallAttribution,
        paywallVariant: PAYWALL_VARIANT,
      });
      if (__DEV__) {
        console.error('Restore failed:', error);
      }
      setFeedback({ message: 'Could not restore purchase.', variant: 'warning' });
    } finally {
      setRestoring(false);
      await refreshFunnelSnapshot();
    }
  }

  async function handleOpenLegal(url: string) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setFeedback({
          message: 'Could not open link right now. Please try again.',
          variant: 'warning',
        });
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to open legal link:', error);
      }
      setFeedback({
        message: 'Could not open link right now. Please try again.',
        variant: 'warning',
      });
    }
  }

  if (isPro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.proContent}>
          <Heading style={{ textAlign: 'center', marginBottom: 8 }}>Baker's Table</Heading>
          <Body style={{ textAlign: 'center', color: theme.colors.success }}>Active</Body>
          <Caption style={{ textAlign: 'center', marginTop: 16, color: theme.colors.textSecondary }}>
            Thank you for supporting StarterBuddy.
          </Caption>
          <Button
            title="Back to Settings"
            variant="text"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16 }}
          />
          <Button
            title="Restore purchases"
            variant="text"
            onPress={handleRestore}
            loading={restoring}
            disabled={restoring || loadingPackageId !== null}
            style={{ marginTop: 8 }}
          />
          <View style={styles.finePrintSection}>
            <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary }}>
              Subscription auto-renews until canceled.
            </Caption>
            <View style={styles.legalLinksRow}>
              <Pressable onPress={() => void handleOpenLegal(TERMS_URL)}>
                <Caption style={[styles.legalLink, { color: theme.colors.primary }]}>Terms of Use</Caption>
              </Pressable>
              <Caption style={{ color: theme.colors.textSecondary }}>·</Caption>
              <Pressable onPress={() => void handleOpenLegal(PRIVACY_URL)}>
                <Caption style={[styles.legalLink, { color: theme.colors.primary }]}>Privacy Policy</Caption>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
    >
      {feedback && (
        <Banner
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      )}
      {!!triggerContext?.message && (
        <Banner
          message={triggerContext.title ? `${triggerContext.title}\n${triggerContext.message}` : triggerContext.message}
          variant="info"
        />
      )}
      {SHOW_DEV_PAYWALL_DEBUG && (
        <Card style={{ marginHorizontal: 0, marginBottom: 12 }}>
          <Label style={{ marginBottom: 8 }}>DEV Paywall Debug</Label>
          <Caption>{`isPro: ${String(isPro)}`}</Caption>
          <Caption>{`offerings: ${offerings.length}`}</Caption>
          <Caption>{`monthly: ${monthlyPackage?.identifier ?? 'none'} | type=${monthlyPackage ? getPackageTypeKey(monthlyPackage) : 'n/a'} | price=${monthlyPackage?.product.priceString ?? 'n/a'} | numeric=${monthlyPrice ?? 'n/a'}`}</Caption>
          <Caption>{`yearly: ${yearlyPackage?.identifier ?? 'none'} | type=${yearlyPackage ? getPackageTypeKey(yearlyPackage) : 'n/a'} | price=${yearlyPackage?.product.priceString ?? 'n/a'} | numeric=${yearlyPrice ?? 'n/a'}`}</Caption>
          <Caption>{`selectedPackageIdentifier: ${selectedPackage?.identifier ?? 'null'}`}</Caption>
          <Caption>{`selectedPackageTypeKey: ${selectedPackage ? getPackageTypeKey(selectedPackage) : 'null'}`}</Caption>
          <Caption>{`segmentedRendered: ${Boolean(monthlyPackage && yearlyPackage)}`}</Caption>
          <Caption>{`defaultBillingIndex: ${yearlyPackage ? 1 : 0}`}</Caption>
          <Caption>{`billingIndex: ${billingIndex} (${billingIndex === 0 ? 'Monthly' : 'Yearly'})`}</Caption>
          <Caption>{`selected: ${selectedPackage?.identifier ?? 'none'} (${billingIndex === 0 ? 'Monthly' : 'Yearly'})`}</Caption>
          <Caption>{`yearlyMonthlyEq: ${yearlyMonthlyEquivalent ?? 'n/a'} | savePercent: ${yearlySavingsPercent ?? 'n/a'}`}</Caption>
          <Caption>{`guards -> loadingPackageId: ${loadingPackageId ?? 'null'}, restoring: ${String(restoring)}, lastEarlyReturn: ${lastGuardReturn}`}</Caption>
          <Caption style={{ marginTop: 8 }}>{`funnel today key: ${funnelSnapshot?.todayKey ?? 'n/a'}`}</Caption>
          <Caption>{`funnel today: ${JSON.stringify(funnelSnapshot?.today.events ?? {})}`}</Caption>
          <Caption>{`funnel allTime: ${JSON.stringify(funnelSnapshot?.allTime.events ?? {})}`}</Caption>
          <Caption>{`funnel triggers (top): ${JSON.stringify(
            Object.entries(funnelSnapshot?.allTime.byTrigger ?? {})
              .sort((a, b) => {
                const aTotal = Object.values(a[1]).reduce((sum, value) => sum + (value ?? 0), 0);
                const bTotal = Object.values(b[1]).reduce((sum, value) => sum + (value ?? 0), 0);
                return bTotal - aTotal;
              })
              .slice(0, 5)
              .map(([key, counts]) => ({ key, counts }))
          )}`}</Caption>
          <Label style={{ marginTop: 10, marginBottom: 6 }}>DEV Conversion Checks</Label>
          <Caption>Trigger Reach (last 7d):</Caption>
          {(conversionChecks?.triggerReach.last7d ?? []).map((row) => (
            <Caption key={`reach-7-${row.trigger}`}>
              {`${row.trigger}: eligible=${row.eligible}, shown=${row.shown}, shown_rate=${formatRate(
                row.shownRate
              )}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 6 }}>Trigger Reach (allTime):</Caption>
          {(conversionChecks?.triggerReach.allTime ?? []).map((row) => (
            <Caption key={`reach-all-${row.trigger}`}>
              {`${row.trigger}: eligible=${row.eligible}, shown=${row.shown}, shown_rate=${formatRate(
                row.shownRate
              )}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 6 }}>
            {`Paywall Engagement total: opened=${conversionChecks?.paywallEngagement.total.opened ?? 0}, start=${conversionChecks?.paywallEngagement.total.start ?? 0}, start_rate=${formatRate(
              conversionChecks?.paywallEngagement.total.startRate ?? 0
            )}`}
          </Caption>
          <Caption style={{ marginTop: 4 }}>Paywall Engagement by trigger:</Caption>
          {(conversionChecks?.paywallEngagement.byTrigger ?? []).map((row) => (
            <Caption key={`eng-trigger-${row.trigger}`}>
              {`${row.trigger}: opened=${row.opened}, start=${row.start}, rate=${formatRate(
                row.startRate
              )}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 4 }}>Paywall Engagement by placement:</Caption>
          {(conversionChecks?.paywallEngagement.byPlacement ?? []).map((row) => (
            <Caption key={`eng-placement-${row.placement}`}>
              {`${row.placement}: opened=${row.opened}, start=${row.start}, rate=${formatRate(
                row.startRate
              )}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 6 }}>
            {`Purchase Outcomes total: success=${conversionChecks?.purchaseOutcomes.total.success ?? 0}, cancel=${conversionChecks?.purchaseOutcomes.total.cancel ?? 0}, fail=${conversionChecks?.purchaseOutcomes.total.fail ?? 0}`}
          </Caption>
          <Caption>
            {`Outcome rates: success=${formatRate(
              conversionChecks?.purchaseOutcomes.total.successRate ?? 0
            )}, cancel=${formatRate(
              conversionChecks?.purchaseOutcomes.total.cancelRate ?? 0
            )}, fail=${formatRate(conversionChecks?.purchaseOutcomes.total.failRate ?? 0)}`}
          </Caption>
          <Caption style={{ marginTop: 4 }}>Purchase Outcomes by trigger:</Caption>
          {(conversionChecks?.purchaseOutcomes.byTrigger ?? []).map((row) => (
            <Caption key={`outcome-${row.trigger}`}>
              {`${row.trigger}: success=${row.success}, cancel=${row.cancel}, fail=${row.fail} | rates s=${formatRate(
                row.successRate
              )}, c=${formatRate(row.cancelRate)}, f=${formatRate(row.failRate)}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 6 }}>
            {`Suppression last7d: ${JSON.stringify(
              conversionChecks?.suppression.last7dByReason ?? {}
            )}`}
          </Caption>
          <Caption>
            {`Suppression allTime: ${JSON.stringify(
              conversionChecks?.suppression.allTimeByReason ?? {}
            )}`}
          </Caption>
          <Caption style={{ marginTop: 6 }}>
            {`Unique Opens: last7d=${conversionChecks?.uniqueOpens.last7d ?? 0}, allTime=${
              conversionChecks?.uniqueOpens.allTime ?? 0
            }`}
          </Caption>
          <Caption>{`Unique Opens by trigger (allTime): ${JSON.stringify(
            conversionChecks?.uniqueOpens.byTriggerAllTime ?? []
          )}`}</Caption>
          <Caption style={{ marginTop: 6 }}>
            {`Timing overall: median=${(
              conversionChecks?.timing.overallMedianSeconds ?? 0
            ).toFixed(1)}s, p90=${(conversionChecks?.timing.overallP90Seconds ?? 0).toFixed(1)}s`}
          </Caption>
          <Caption>{`Timing by trigger: ${JSON.stringify(
            conversionChecks?.timing.byTrigger ?? []
          )}`}</Caption>
          <Caption style={{ marginTop: 6 }}>{`By variant: ${JSON.stringify(
            conversionChecks?.byVariant ?? []
          )}`}</Caption>
          <Caption style={{ marginTop: 6 }}>
            {`Integrity: triggersShown=${conversionChecks?.integrity.triggersShown ?? 0}, paywallOpened=${
              conversionChecks?.integrity.paywallOpened ?? 0
            }, mismatch=${conversionChecks?.integrity.mismatch ?? 0}`}
          </Caption>
          {(conversionChecks?.integrity.mismatch ?? 0) > 0 && (
            <Caption style={{ color: theme.colors.danger }}>
              Paywall routing may be dropping events.
            </Caption>
          )}
          {(conversionChecks?.integrity.mismatches ?? []).map((row, index) => (
            <Caption key={`integrity-${row.dayKey}-${row.trigger}-${row.placement}-${index}`}>
              {`${row.dayKey} | ${row.trigger} | ${row.placement} | diff=${row.diff}`}
            </Caption>
          ))}
          <Caption style={{ marginTop: 6 }}>{`Trigger leaderboard (uniqueOpened >= 5): ${JSON.stringify(
            conversionChecks?.leaderboard ?? []
          )}`}</Caption>
          <Text
            selectable
            style={{ marginTop: 6, color: theme.colors.textSecondary, fontSize: 12 }}
          >
            {`snapshotJson: ${JSON.stringify(funnelSnapshot ?? {})}`}
          </Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <Button
              title="DEV: Simulate purchase canceled"
              variant="text"
              onPress={() => setFeedback({ message: 'Purchase canceled.', variant: 'info' })}
            />
            <Button
              title="DEV: Simulate purchase failure"
              variant="text"
              onPress={() =>
                setFeedback({
                  message: 'Could not complete purchase. Please try again.',
                  variant: 'warning',
                })
              }
            />
            <Button
              title="DEV: Simulate restore success"
              variant="text"
              onPress={() => setFeedback({ message: 'Purchases restored.', variant: 'success' })}
            />
            <Button
              title="DEV: Simulate restore none"
              variant="text"
              onPress={() =>
                setFeedback({ message: 'No previous purchases were found.', variant: 'info' })
              }
            />
            <Button
              title="Reset debug state (DEV)"
              variant="text"
              onPress={() => {
                setFeedback(null);
                setBillingIndex(yearlyPackage ? 1 : 0);
                setLoadingPackageId(null);
                setRestoring(false);
                setLastGuardReturn('none');
              }}
            />
            <Button
              title="Reset funnel (DEV)"
              variant="text"
              onPress={() => {
                void (async () => {
                  await resetFunnel();
                  await refreshFunnelSnapshot();
                })();
              }}
            />
            <Button
              title="Force show paywall (trigger: analytics_opened_locked)"
              variant="text"
              onPress={() => {
                void maybeShowProPaywall(
                  navigation,
                  isPro,
                  'analytics_opened_locked',
                  {
                    title: 'Analytics (Pro)',
                    message: 'See peak trend, best ratios, and consistency insights.',
                    placement: 'debug_force',
                  },
                  { force: true }
                );
              }}
            />
            {(() => {
              let ClipboardModule: { setStringAsync?: (value: string) => Promise<void> } | null =
                null;
              try {
                ClipboardModule = require('expo-clipboard');
              } catch {
                ClipboardModule = null;
              }
              if (!ClipboardModule?.setStringAsync) return null;
              return (
                <Button
                  title="Copy JSON (DEV)"
                  variant="text"
                  onPress={() => {
                    void ClipboardModule?.setStringAsync?.(JSON.stringify(funnelSnapshot ?? {}));
                  }}
                />
              );
            })()}
          </View>
        </Card>
      )}
      <View style={styles.header}>
        <Heading style={{ fontSize: 34, textAlign: 'center', marginBottom: 8 }}>Unlock Baker&apos;s Table</Heading>
        <Subheading style={{ textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
          Plan better, hit more consistent peaks, and manage multiple cultures with confidence.
        </Subheading>
        {starterCount > 1 && (
          <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 6 }}>
            You have multiple cultures - Pro lets you manage them all.
          </Caption>
        )}
        {hasAnalyticsData && (
          <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary }}>
            See your peak trend and best ratios.
          </Caption>
        )}
      </View>

      <Card style={{ marginHorizontal: 0, marginBottom: 24 }}>
        <View style={{ paddingVertical: 28, paddingHorizontal: 20 }}>
          {BENEFITS.map((benefit, i) => (
            <View key={benefit} style={[styles.benefitRow, i < BENEFITS.length - 1 && { marginBottom: 14 }]}>
              <Body style={{ color: theme.colors.primary, marginRight: 10 }}>•</Body>
              <Body style={{ fontSize: 16 }}>{benefit}</Body>
            </View>
          ))}
        </View>
      </Card>

      <Caption style={{ textAlign: 'center', color: theme.colors.textMuted ?? theme.colors.textSecondary, marginBottom: 12 }}>
        Your baking data stays on-device.
      </Caption>
      {offerings.length === 0 ? (
        <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary, marginTop: 12 }}>
          Plans are unavailable right now. Please try again in a moment.
        </Caption>
      ) : (
        <>
          {monthlyPackage && yearlyPackage && (
            <View style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={['Monthly', 'Yearly']}
                selectedIndex={billingIndex}
                onSelect={setBillingIndex}
              />
            </View>
          )}
          {selectedPackage && (
            <Card style={{ marginHorizontal: 0, marginBottom: 12 }}>
              <View style={styles.packageRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={styles.planTitleRow}>
                    <Body style={{ fontWeight: '700' }}>Baker&apos;s Table (Pro)</Body>
                    {yearlyPackage && selectedPackage.identifier === yearlyPackage.identifier && (
                      <View
                        style={[
                          styles.bestValueBadge,
                          { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary },
                        ]}
                      >
                        <Caption style={{ color: theme.colors.primary }}>
                          {yearlySavingsPercent ? `Best value • Save ~${yearlySavingsPercent}%` : 'Best value'}
                        </Caption>
                        </View>
                    )}
                  </View>
                  <Caption style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                    {getPackageLabel(selectedPackage)}
                  </Caption>
                  <Text style={[styles.billedPrice, { color: theme.colors.text }]}>
                    {selectedPackage.product.priceString}
                  </Text>
                  {yearlyPackage &&
                    selectedPackage.identifier === yearlyPackage.identifier &&
                    yearlyMonthlyEquivalent && (
                      <Caption style={{ color: theme.colors.textSecondary, marginTop: 2 }}>
                        {`≈ $${yearlyMonthlyEquivalent.toFixed(2)} / month (billed yearly)`}
                      </Caption>
                    )}
                </View>
              </View>
            </Card>
          )}

          {selectedPackage && (
            <Button
              title="Start Pro"
              onPress={() => handlePurchase(selectedPackage)}
              loading={loadingPackageId === selectedPackage.identifier}
              disabled={loadingPackageId !== null || restoring}
              style={{ marginTop: 8 }}
            />
          )}
          {selectedPackage && (
            <Caption style={{ textAlign: 'center', marginTop: 10, color: theme.colors.textSecondary, lineHeight: 18 }}>
              Cancel anytime. Apple manages billing.
            </Caption>
          )}
          {selectedPackage && (
            <View style={styles.finePrintSection}>
              <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary }}>
                Subscription auto-renews until canceled.
              </Caption>
              <View style={styles.legalLinksRow}>
                <Pressable onPress={() => void handleOpenLegal(TERMS_URL)}>
                  <Caption style={[styles.legalLink, { color: theme.colors.primary }]}>Terms of Use</Caption>
                </Pressable>
                <Caption style={{ color: theme.colors.textSecondary }}>·</Caption>
                <Pressable onPress={() => void handleOpenLegal(PRIVACY_URL)}>
                  <Caption style={[styles.legalLink, { color: theme.colors.primary }]}>Privacy Policy</Caption>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.secondaryActionsRow}>
        <Button
          title="Restore purchases"
          variant="text"
          onPress={handleRestore}
          loading={restoring}
          disabled={restoring || loadingPackageId !== null}
        />
        <Button
          title="Not now"
          variant="text"
          onPress={() => navigation.goBack()}
          disabled={restoring || loadingPackageId !== null}
        />
      </View>

      <Caption style={{ textAlign: 'center', marginTop: 6, color: theme.colors.textSecondary, lineHeight: 18 }}>
        Subscription renews automatically in App Store settings.
      </Caption>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  proContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestValueBadge: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  secondaryActionsRow: {
    marginTop: 10,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  billedPrice: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  finePrintSection: {
    marginTop: 12,
  },
  legalLinksRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});
