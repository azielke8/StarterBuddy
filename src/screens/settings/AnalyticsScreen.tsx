import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Body, Caption, Heading, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getAllEvents, getAllStarters, getEventsForStarter } from '../../db';
import { Starter, StarterEvent } from '../../models/types';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatHoursToHm(hours: number): string {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseLevEndDuration(notes: string | null | undefined): number | null {
  if (!notes || !notes.startsWith('LEV_END|')) return null;
  const firstLine = notes.split('\n')[0] ?? notes;
  const parts = firstLine.split('|');
  if (parts.length < 4 || parts[2] !== 'START') return null;
  const end = new Date(parts[1]);
  const start = new Date(parts[3]);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return null;
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return null;
  return durationMs;
}

function parsePeakHours(event: StarterEvent): number | null {
  if (event.peak_confirmed_hours != null) return event.peak_confirmed_hours;
  const notes = event.notes;
  const firstLine = notes?.split('\n')[0] ?? '';
  if (firstLine.startsWith('LEV_PEAK|')) {
    const parts = firstLine.split('|');
    const value = Number(parts[3]);
    if (Number.isFinite(value)) return value;
  }

  const type = String((event as { type?: string }).type ?? '').toUpperCase();
  const looksLikePeak = type.includes('PEAK') || type.includes('CONFIRM') || /peak/i.test(firstLine);
  if (!looksLikePeak) return null;

  const hoursMatch = firstLine.match(/(-?\d+(?:\.\d+)?)\s*h(?:ours?)?\b/i);
  if (hoursMatch) {
    const value = Number(hoursMatch[1]);
    if (Number.isFinite(value)) return value;
  }

  const pipeHoursMatch = firstLine.match(/HOURS?\|(-?\d+(?:\.\d+)?)/i);
  if (pipeHoursMatch) {
    const value = Number(pipeHoursMatch[1]);
    if (Number.isFinite(value)) return value;
  }

  const numericMatches = [...firstLine.matchAll(/-?\d+(?:\.\d+)?/g)];
  for (const match of numericMatches) {
    const value = Number(match[0]);
    if (Number.isFinite(value) && value > 0.1 && value <= 72) {
      return value;
    }
  }

  return null;
}

function parseRatioFromLevPeakNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const firstLine = notes.split('\n')[0] ?? notes;
  const parts = firstLine.split('|');
  const ratioIndex = parts.findIndex((part) => part === 'RATIO');
  if (ratioIndex === -1 || ratioIndex + 1 >= parts.length) return null;
  const ratio = parts[ratioIndex + 1]?.trim();
  return ratio ? ratio : null;
}

function formatDelta(current: number, previous: number): string {
  const delta = current - previous;
  if (Math.abs(delta) < 0.1) return 'Holding steady';
  const amount = `${Math.abs(delta).toFixed(1)}h`;
  return delta < 0 ? `${amount} faster` : `${amount} slower`;
}

export function AnalyticsScreen() {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const navigation = useNavigation<any>();
  const [starters, setStarters] = useState<Starter[]>([]);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [events, setEvents] = useState<StarterEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const selectedStarterIdRef = useRef<string | null>(null);
  const lockedMessage =
    "Peak trend + best ratios + consistency insights are included with Baker's Table.";

  useEffect(() => {
    selectedStarterIdRef.current = selectedStarterId;
  }, [selectedStarterId]);

  const loadAnalytics = useCallback(
    async (preferredStarterId?: string | null, isActive?: () => boolean) => {
      const isScreenActive = isActive ?? (() => true);
      const allStarters = await getAllStarters();
      if (!isScreenActive()) return;
      setStarters(allStarters);
      if (allStarters.length === 0) {
        setSelectedStarterId(null);
        setEvents([]);
        return;
      }

      const currentSelected = preferredStarterId ?? selectedStarterIdRef.current;
      const currentSelectedExists = currentSelected
        ? allStarters.some((starter) => starter.id === currentSelected)
        : false;

      let nextSelected = currentSelected;
      if (!currentSelectedExists) {
        const allEvents = await getAllEvents();
        if (!isScreenActive()) return;
        const mostRecentStarterId = allEvents.find((event) =>
          allStarters.some((starter) => starter.id === event.starter_id)
        )?.starter_id;
        nextSelected = mostRecentStarterId ?? allStarters[0].id;
      }

      if (!nextSelected) {
        setEvents([]);
        return;
      }

      setSelectedStarterId(nextSelected);
      const starterEvents = await getEventsForStarter(nextSelected);
      if (!isScreenActive()) return;
      setEvents(starterEvents);
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      if (!isPro) return;
      let active = true;
      void loadAnalytics(undefined, () => active);
      return () => {
        active = false;
      };
    }, [isPro, loadAnalytics, navigation])
  );

  const selectedIndex = useMemo(
    () => starters.findIndex((starter) => starter.id === selectedStarterId),
    [starters, selectedStarterId]
  );

  const peakEvents = useMemo(() => {
    return events
      .map((event) => {
        const trimmed = event.ratio_string?.trim();
        const ratio = trimmed && trimmed.length > 0 ? trimmed : parseRatioFromLevPeakNotes(event.notes);
        return {
          hours: parsePeakHours(event),
          ratio,
        };
      })
      .filter((entry): entry is { hours: number; ratio: string | null } => entry.hours != null);
  }, [events]);

  const peakValues = useMemo(() => peakEvents.map((entry) => entry.hours), [peakEvents]);
  const lastSeven = peakValues.slice(0, 7);
  const previousSeven = peakValues.slice(7, 14);
  const avgLastSeven = lastSeven.length > 0
    ? lastSeven.reduce((sum, v) => sum + v, 0) / lastSeven.length
    : null;
  const avgPreviousSeven = previousSeven.length > 0
    ? previousSeven.reduce((sum, v) => sum + v, 0) / previousSeven.length
    : null;

  const bestRatios = useMemo(() => {
    const grouped = new Map<string, number[]>();
    for (const event of peakEvents) {
      if (!event.ratio) continue;
      const current = grouped.get(event.ratio) ?? [];
      current.push(event.hours);
      grouped.set(event.ratio, current);
    }
    return [...grouped.entries()]
      .map(([ratio, values]) => ({ ratio, median: median(values), count: values.length }))
      .filter((entry): entry is { ratio: string; median: number; count: number } => entry.median != null && entry.count >= 2)
      .sort((a, b) => a.median - b.median)
      .slice(0, 3);
  }, [peakEvents]);
  const peakEventsMissingRatioCount = useMemo(
    () => peakEvents.filter((entry) => !entry.ratio).length,
    [peakEvents]
  );

  const consistencyWindow = peakValues.slice(0, 10);
  const consistencyStdDev = stdDev(consistencyWindow);
  const strengthLabel = consistencyWindow.length < 2
    ? 'Not enough data yet'
    : consistencyStdDev <= 0.5
    ? 'Very stable'
    : consistencyStdDev <= 1
    ? 'Stable'
    : 'Variable';
  const strengthBody = consistencyWindow.length < 2
    ? 'Confirm peak at least twice to unlock consistency insights.'
    : consistencyStdDev <= 1
    ? 'Your peak timing is consistent — planning will be more reliable.'
    : 'Timing varies more between sessions — keep confirming peaks to tighten forecasts.';

  const latestSessionDuration = useMemo(() => {
    const latestEnd = events.find((event) => event.notes?.startsWith('LEV_END|'));
    return latestEnd ? parseLevEndDuration(latestEnd.notes) : null;
  }, [events]);
  const parsedPeakCount = useMemo(
    () => events.filter((event) => parsePeakHours(event) != null).length,
    [events]
  );
  const debugCandidates = useMemo(
    () =>
      events.slice(0, 5).map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        type: event.type,
        firstLine: event.notes?.split('\n')[0] ?? '',
        parsedHours: parsePeakHours(event),
      })),
    [events]
  );

  if (!isPro) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        <Card>
          <Heading style={{ marginBottom: 8 }}>Analytics (Pro)</Heading>
          <Body style={{ color: theme.colors.textSecondary }}>{lockedMessage}</Body>
          <Button
            title="Upgrade"
            onPress={() =>
              navigation.getParent()?.navigate(
                'ProPaywall' as never,
                {
                  trigger: 'analytics_opened_locked',
                  placement: 'settings_analytics',
                  title: 'Unlock Analytics',
                  message: lockedMessage,
                } as never
              )
            }
            style={{ marginTop: 16 }}
          />
          <Button
            title="Back to Settings"
            variant="text"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await loadAnalytics();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      {__DEV__ && (
        <Card style={{ marginHorizontal: 0, marginBottom: 12 }}>
          <Label style={{ marginBottom: 8 }}>Debug</Label>
          <Caption style={{ color: theme.colors.textSecondary }}>{`Events loaded: ${events.length}`}</Caption>
          <Caption style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{`Parsed peaks: ${parsedPeakCount}`}</Caption>
          {debugCandidates.map((event) => (
            <Caption key={event.id} style={{ marginTop: 6, color: theme.colors.textSecondary }}>
              {`${event.timestamp} | ${event.type} | ${event.firstLine || '(no notes)'} | parsed: ${
                event.parsedHours == null ? 'null' : event.parsedHours.toFixed(2)
              }`}
            </Caption>
          ))}
        </Card>
      )}

      {starters.length > 1 && (
        <View style={styles.section}>
          <Label style={styles.sectionLabel}>Culture</Label>
          <SegmentedControl
            options={starters.map((starter) => starter.name)}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
            onSelect={(index) => {
              const starter = starters[index];
              if (!starter) return;
              void loadAnalytics(starter.id);
            }}
          />
        </View>
      )}

      <Card style={{ marginHorizontal: 0, marginBottom: 12 }}>
        <Caption style={{ color: theme.colors.textMuted ?? theme.colors.textSecondary, marginBottom: 6 }}>
          Peak trend
        </Caption>
        <Caption style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>
          {`Peak confirmations: ${peakValues.length}`}
        </Caption>
        {peakValues.length === 0 || avgLastSeven == null ? (
          <Body>Confirm peak to start seeing trends.</Body>
        ) : (
          <>
            <Heading style={{ marginBottom: 6 }}>{`${avgLastSeven.toFixed(1)}h average`}</Heading>
            {lastSeven.length >= 2 && (
              <Body style={{ marginBottom: 4, color: theme.colors.textSecondary }}>
                {`${(median(lastSeven) ?? avgLastSeven).toFixed(1)}h median`}
              </Body>
            )}
            <Body style={{ color: theme.colors.textSecondary }}>
              {previousSeven.length < 2 || avgPreviousSeven == null
                ? 'Confirm a few more peaks to see trends.'
                : `${formatDelta(avgLastSeven, avgPreviousSeven)} vs previous confirmations`}
            </Body>
          </>
        )}
      </Card>

      <Card style={{ marginHorizontal: 0, marginBottom: 12 }}>
        <Label style={{ marginBottom: 8 }}>Best ratios</Label>
        {bestRatios.length === 0 ? (
          <>
            <Caption style={{ color: theme.colors.textSecondary }}>
              Add a few confirmed peaks with saved ratios to see what works best.
            </Caption>
            {peakEventsMissingRatioCount > 0 && (
              <Caption style={{ color: theme.colors.textSecondary, marginTop: 6 }}>
                Confirm peaks after saving a plan/ratio to unlock best ratios.
              </Caption>
            )}
          </>
        ) : (
          bestRatios.map((entry) => (
            <View key={entry.ratio} style={styles.row}>
              <Body>{entry.ratio}</Body>
              <Body style={{ fontWeight: '600' }}>{`${entry.median.toFixed(1)}h median`}</Body>
            </View>
          ))
        )}
      </Card>

      <Card style={{ marginHorizontal: 0 }}>
        <Label style={{ marginBottom: 8 }}>Strength</Label>
        <Body style={{ marginBottom: 4 }}>{strengthLabel}</Body>
        {consistencyWindow.length >= 2 && (
          <Caption style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>
            {`Std dev: ${consistencyStdDev.toFixed(2)}h`}
          </Caption>
        )}
        <Caption style={{ color: theme.colors.textSecondary }}>{strengthBody}</Caption>
        {latestSessionDuration != null && (
          <Caption style={{ marginTop: 10, color: theme.colors.textSecondary }}>
            {`Last levain session: ${formatHoursToHm(latestSessionDuration / (1000 * 60 * 60))}`}
          </Caption>
        )}
      </Card>
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
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
