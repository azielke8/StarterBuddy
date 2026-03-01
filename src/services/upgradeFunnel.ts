import { File, Paths } from 'expo-file-system';

export type FunnelEvent =
  | 'trigger_eligible'
  | 'trigger_shown'
  | 'trigger_suppressed'
  | 'paywall_opened'
  | 'start_purchase'
  | 'purchase_success'
  | 'purchase_cancel'
  | 'purchase_fail'
  | 'restore_started'
  | 'restore_success'
  | 'restore_none'
  | 'restore_fail';

export type FunnelContext = {
  trigger?: string | null;
  placement?: string | null;
  packageId?: string | null;
  paywallVariant?: string | null;
  reason?: 'globalCooldown' | 'triggerCooldown' | 'sessionThrottle' | 'isPro' | 'unknown' | null;
  sessionId?: string | null;
};

type FunnelCounts = Partial<Record<FunnelEvent, number>>;
type FunnelRecord = {
  ts: number;
  dayKey: string;
  event: FunnelEvent;
  trigger?: string | null;
  placement?: string | null;
  packageId?: string | null;
  paywallVariant?: string | null;
  reason?: string | null;
  sessionId?: string | null;
};

type FunnelBucket = {
  events: FunnelCounts;
  byTrigger: Record<string, FunnelCounts>;
  byPlacement: Record<string, FunnelCounts>;
  byPackage: Record<string, FunnelCounts>;
  byVariant: Record<string, FunnelCounts>;
  byReason: Record<string, FunnelCounts>;
  records: FunnelRecord[];
};

type FunnelStore = {
  byDay: Record<string, FunnelBucket>;
  allTime: FunnelBucket;
};

export type FunnelSnapshot = {
  todayKey: string;
  today: FunnelBucket;
  allTime: FunnelBucket;
  byDay: Record<string, FunnelBucket>;
};

export type ConversionChecks = {
  triggerReach: {
    allTime: Array<{ trigger: string; eligible: number; shown: number; shownRate: number }>;
    last7d: Array<{ trigger: string; eligible: number; shown: number; shownRate: number }>;
  };
  paywallEngagement: {
    total: { opened: number; start: number; startRate: number };
    byTrigger: Array<{ trigger: string; opened: number; start: number; startRate: number }>;
    byPlacement: Array<{ placement: string; opened: number; start: number; startRate: number }>;
  };
  purchaseOutcomes: {
    total: {
      start: number;
      success: number;
      cancel: number;
      fail: number;
      successRate: number;
      cancelRate: number;
      failRate: number;
    };
    byTrigger: Array<{
      trigger: string;
      start: number;
      success: number;
      cancel: number;
      fail: number;
      successRate: number;
      cancelRate: number;
      failRate: number;
    }>;
  };
  suppression: {
    allTimeByReason: Record<string, number>;
    last7dByReason: Record<string, number>;
  };
  byVariant: Array<{
    paywallVariant: string;
    uniqueOpened: number;
    opened: number;
    start: number;
    success: number;
    startRate: number;
    successRate: number;
    medianTimeToStartSeconds: number;
  }>;
  uniqueOpens: {
    allTime: number;
    last7d: number;
    byTriggerAllTime: Array<{ trigger: string; uniqueOpened: number }>;
    byTriggerLast7d: Array<{ trigger: string; uniqueOpened: number }>;
  };
  timing: {
    overallMedianSeconds: number;
    overallP90Seconds: number;
    byTrigger: Array<{ trigger: string; medianSeconds: number; count: number }>;
  };
  integrity: {
    triggersShown: number;
    paywallOpened: number;
    mismatch: number;
    mismatches: Array<{ dayKey: string; trigger: string; placement: string; diff: number }>;
  };
  leaderboard: Array<{
    trigger: string;
    eligible: number;
    shown: number;
    uniqueOpened: number;
    started: number;
    startRate: number;
  }>;
};

const FUNNEL_FILE = new File(Paths.document, 'upgrade-funnel.json');
const SESSION_FILE = new File(Paths.document, 'upgrade-funnel-session.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RECORDS = 500;
const KNOWN_TRIGGER_KEYS = [
  'analytics_opened_locked',
  'multi_culture_locked_action',
];
let inMemorySessionId: string | null = null;

function createEmptyBucket(): FunnelBucket {
  return {
    events: {},
    byTrigger: {},
    byPlacement: {},
    byPackage: {},
    byVariant: {},
    byReason: {},
    records: [],
  };
}

function createEmptyStore(): FunnelStore {
  return {
    byDay: {},
    allTime: createEmptyBucket(),
  };
}

function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function incrementCount(counts: FunnelCounts, event: FunnelEvent) {
  counts[event] = (counts[event] ?? 0) + 1;
}

function incrementNested(
  record: Record<string, FunnelCounts>,
  key: string | null | undefined,
  event: FunnelEvent
) {
  if (!key) return;
  if (!record[key]) {
    record[key] = {};
  }
  incrementCount(record[key], event);
}

function incrementBucket(bucket: FunnelBucket, event: FunnelEvent, ctx?: FunnelContext) {
  incrementCount(bucket.events, event);
  incrementNested(bucket.byTrigger, ctx?.trigger ?? null, event);
  incrementNested(bucket.byPlacement, ctx?.placement ?? null, event);
  incrementNested(bucket.byPackage, ctx?.packageId ?? null, event);
  incrementNested(bucket.byVariant, ctx?.paywallVariant ?? null, event);
  incrementNested(bucket.byReason, ctx?.reason ?? null, event);
}

function normalizeContextValue(
  value: string | null | undefined,
  opts?: { lower?: boolean }
): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return opts?.lower ? normalized.toLowerCase() : normalized;
}

function makeSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getSessionId(): Promise<string> {
  if (inMemorySessionId) return inMemorySessionId;
  try {
    const raw = (await SESSION_FILE.text()).trim();
    if (raw) {
      const parsed = JSON.parse(raw) as { sessionId?: string; createdAt?: number };
      if (
        typeof parsed.sessionId === 'string' &&
        typeof parsed.createdAt === 'number' &&
        Date.now() - parsed.createdAt <= SESSION_TTL_MS
      ) {
        inMemorySessionId = parsed.sessionId;
        return inMemorySessionId;
      }
    }
  } catch {
    // Best effort; generate new session id below.
  }

  inMemorySessionId = makeSessionId();
  try {
    await SESSION_FILE.create({ overwrite: true });
    await SESSION_FILE.write(
      JSON.stringify({ sessionId: inMemorySessionId, createdAt: Date.now() })
    );
  } catch {
    // Best effort persistence.
  }
  return inMemorySessionId;
}

async function readStore(): Promise<FunnelStore> {
  try {
    const raw = (await FUNNEL_FILE.text()).trim();
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as FunnelStore;
    const normalizeBucket = (bucket: FunnelBucket | undefined): FunnelBucket => ({
      ...createEmptyBucket(),
      ...(bucket ?? createEmptyBucket()),
      events: bucket?.events ?? {},
      byTrigger: bucket?.byTrigger ?? {},
      byPlacement: bucket?.byPlacement ?? {},
      byPackage: bucket?.byPackage ?? {},
      byVariant: bucket?.byVariant ?? {},
      byReason: bucket?.byReason ?? {},
      records: Array.isArray(bucket?.records) ? bucket?.records : [],
    });
    const byDay = Object.fromEntries(
      Object.entries(parsed.byDay ?? {}).map(([dayKey, bucket]) => [dayKey, normalizeBucket(bucket)])
    );
    return {
      byDay,
      allTime: normalizeBucket(parsed.allTime),
    };
  } catch {
    return createEmptyStore();
  }
}

async function writeStore(store: FunnelStore): Promise<void> {
  try {
    await FUNNEL_FILE.create({ overwrite: true });
    await FUNNEL_FILE.write(JSON.stringify(store));
  } catch {
    // Best effort persistence.
  }
}

export async function trackFunnel(event: FunnelEvent, ctx?: FunnelContext): Promise<void> {
  try {
    const dayKey = getDateKey();
    const sessionId = ctx?.sessionId ?? (await getSessionId());
    const store = await readStore();
    if (!store.byDay[dayKey]) {
      store.byDay[dayKey] = createEmptyBucket();
    }
    const nextCtx: FunnelContext = {
      ...ctx,
      trigger: normalizeContextValue(ctx?.trigger, { lower: true }),
      placement: normalizeContextValue(ctx?.placement, { lower: true }),
      packageId: normalizeContextValue(ctx?.packageId),
      paywallVariant: normalizeContextValue(ctx?.paywallVariant, { lower: true }),
      sessionId,
    };
    const record: FunnelRecord = {
      ts: Date.now(),
      dayKey,
      event,
      trigger: nextCtx.trigger ?? null,
      placement: nextCtx.placement ?? null,
      packageId: nextCtx.packageId ?? null,
      paywallVariant: nextCtx.paywallVariant ?? null,
      reason: nextCtx.reason ?? null,
      sessionId: nextCtx.sessionId ?? null,
    };
    incrementBucket(store.byDay[dayKey], event, nextCtx);
    incrementBucket(store.allTime, event, nextCtx);
    store.byDay[dayKey].records.push(record);
    store.allTime.records.push(record);
    if (store.byDay[dayKey].records.length > MAX_RECORDS) {
      store.byDay[dayKey].records = store.byDay[dayKey].records.slice(-MAX_RECORDS);
    }
    if (store.allTime.records.length > MAX_RECORDS) {
      store.allTime.records = store.allTime.records.slice(-MAX_RECORDS);
    }
    await writeStore(store);
  } catch {
    // Never break core flows due to analytics writes.
  }
}

export async function getFunnelSnapshot(): Promise<FunnelSnapshot> {
  const todayKey = getDateKey();
  const store = await readStore();
  return {
    todayKey,
    today: store.byDay[todayKey] ?? createEmptyBucket(),
    allTime: store.allTime ?? createEmptyBucket(),
    byDay: store.byDay ?? {},
  };
}

export async function resetFunnel(): Promise<void> {
  await writeStore(createEmptyStore());
}

function sumEvents(counts: FunnelCounts, key: FunnelEvent): number {
  return counts[key] ?? 0;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function aggregateBuckets(buckets: FunnelBucket[]): FunnelBucket {
  const aggregated = createEmptyBucket();
  for (const bucket of buckets) {
    for (const [event, count] of Object.entries(bucket.events)) {
      if (!count) continue;
      const key = event as FunnelEvent;
      aggregated.events[key] = (aggregated.events[key] ?? 0) + count;
    }

    const mergeNested = (
      target: Record<string, FunnelCounts>,
      source: Record<string, FunnelCounts>
    ) => {
      for (const [groupKey, counts] of Object.entries(source)) {
        if (!target[groupKey]) target[groupKey] = {};
        for (const [event, count] of Object.entries(counts)) {
          if (!count) continue;
          const eventKey = event as FunnelEvent;
          target[groupKey][eventKey] = (target[groupKey][eventKey] ?? 0) + count;
        }
      }
    };

    mergeNested(aggregated.byTrigger, bucket.byTrigger);
    mergeNested(aggregated.byPlacement, bucket.byPlacement);
    mergeNested(aggregated.byPackage, bucket.byPackage);
    mergeNested(aggregated.byVariant, bucket.byVariant);
    mergeNested(aggregated.byReason, bucket.byReason);
    aggregated.records.push(...bucket.records);
  }
  return aggregated;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const bounded = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[bounded];
}

function medianSeconds(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function getUniqueOpenedCounts(records: FunnelRecord[]) {
  let total = 0;
  const byTrigger = new Map<string, number>();
  const byVariant = new Map<string, number>();
  const seen = new Set<string>();
  for (const record of records) {
    if (record.event !== 'paywall_opened') continue;
    const triggerKey = record.trigger ?? 'unknown';
    const variantKey = record.paywallVariant ?? 'unknown';
    if (!record.sessionId) {
      total += 1;
      byTrigger.set(triggerKey, (byTrigger.get(triggerKey) ?? 0) + 1);
      byVariant.set(variantKey, (byVariant.get(variantKey) ?? 0) + 1);
      continue;
    }
    const dedupeKey = `${record.dayKey}|${triggerKey}|${record.sessionId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    total += 1;
    byTrigger.set(triggerKey, (byTrigger.get(triggerKey) ?? 0) + 1);
    byVariant.set(variantKey, (byVariant.get(variantKey) ?? 0) + 1);
  }
  return { total, byTrigger, byVariant };
}

function getTimeToStartDurations(records: FunnelRecord[]): {
  overall: number[];
  byTrigger: Map<string, number[]>;
  byVariant: Map<string, number[]>;
} {
  const opensBySession = new Map<string, FunnelRecord[]>();
  const byTrigger = new Map<string, number[]>();
  const byVariant = new Map<string, number[]>();
  const overall: number[] = [];

  const sorted = [...records].sort((a, b) => a.ts - b.ts);
  for (const record of sorted) {
    if (!record.sessionId) continue;
    if (record.event === 'paywall_opened') {
      const list = opensBySession.get(record.sessionId) ?? [];
      list.push(record);
      opensBySession.set(record.sessionId, list);
      continue;
    }
    if (record.event !== 'start_purchase') continue;
    const opens = opensBySession.get(record.sessionId) ?? [];
    if (opens.length === 0) continue;
    let matched: FunnelRecord | null = null;
    for (let i = opens.length - 1; i >= 0; i -= 1) {
      const candidate = opens[i];
      const sameTrigger =
        !record.trigger || !candidate.trigger || candidate.trigger === record.trigger;
      if (sameTrigger && candidate.ts <= record.ts) {
        matched = candidate;
        break;
      }
    }
    if (!matched) continue;
    const diffSeconds = Math.max(0, (record.ts - matched.ts) / 1000);
    overall.push(diffSeconds);
    const triggerKey = record.trigger ?? 'unknown';
    const list = byTrigger.get(triggerKey) ?? [];
    list.push(diffSeconds);
    byTrigger.set(triggerKey, list);
    const variantKey = record.paywallVariant ?? matched.paywallVariant ?? 'unknown';
    const variantList = byVariant.get(variantKey) ?? [];
    variantList.push(diffSeconds);
    byVariant.set(variantKey, variantList);
  }

  return { overall, byTrigger, byVariant };
}

export function computeConversionChecks(snapshot: FunnelSnapshot): ConversionChecks {
  const sortedDayKeys = Object.keys(snapshot.byDay).sort();
  const last7Keys = sortedDayKeys.slice(-7);
  const last7Bucket = aggregateBuckets(last7Keys.map((key) => snapshot.byDay[key]));
  const allTimeBucket = snapshot.allTime;

  const triggerKeys = Array.from(
    new Set([
      ...KNOWN_TRIGGER_KEYS,
      ...Object.keys(allTimeBucket.byTrigger),
      ...Object.keys(last7Bucket.byTrigger),
    ])
  );

  const triggerRowsFromBucket = (bucket: FunnelBucket) =>
    triggerKeys
      .map((trigger) => {
        const counts = bucket.byTrigger[trigger] ?? {};
        const eligible = sumEvents(counts, 'trigger_eligible');
        const shown = sumEvents(counts, 'trigger_shown');
        return {
          trigger,
          eligible,
          shown,
          shownRate: rate(shown, eligible),
        };
      })
      .filter((row) => row.eligible > 0 || row.shown > 0);

  const paywallOpenedAll = sumEvents(allTimeBucket.events, 'paywall_opened');
  const startPurchaseAll = sumEvents(allTimeBucket.events, 'start_purchase');

  const byTriggerEngagement = Object.entries(allTimeBucket.byTrigger)
    .map(([trigger, counts]) => {
      const opened = sumEvents(counts, 'paywall_opened');
      const start = sumEvents(counts, 'start_purchase');
      return {
        trigger,
        opened,
        start,
        startRate: rate(start, opened),
      };
    })
    .filter((row) => row.opened > 0 || row.start > 0);

  const byPlacementEngagement = Object.entries(allTimeBucket.byPlacement)
    .map(([placement, counts]) => {
      const opened = sumEvents(counts, 'paywall_opened');
      const start = sumEvents(counts, 'start_purchase');
      return {
        placement,
        opened,
        start,
        startRate: rate(start, opened),
      };
    })
    .filter((row) => row.opened > 0 || row.start > 0);

  const totalStart = sumEvents(allTimeBucket.events, 'start_purchase');
  const totalSuccess = sumEvents(allTimeBucket.events, 'purchase_success');
  const totalCancel = sumEvents(allTimeBucket.events, 'purchase_cancel');
  const totalFail = sumEvents(allTimeBucket.events, 'purchase_fail');

  const purchaseByTrigger = Object.entries(allTimeBucket.byTrigger)
    .map(([trigger, counts]) => {
      const start = sumEvents(counts, 'start_purchase');
      const success = sumEvents(counts, 'purchase_success');
      const cancel = sumEvents(counts, 'purchase_cancel');
      const fail = sumEvents(counts, 'purchase_fail');
      return {
        trigger,
        start,
        success,
        cancel,
        fail,
        successRate: rate(success, start),
        cancelRate: rate(cancel, start),
        failRate: rate(fail, start),
      };
    })
    .filter((row) => row.start > 0 || row.success > 0 || row.cancel > 0 || row.fail > 0);

  const suppressionFromBucket = (bucket: FunnelBucket) => {
    const result: Record<string, number> = {};
    for (const [reason, counts] of Object.entries(bucket.byReason)) {
      const suppressed = sumEvents(counts, 'trigger_suppressed');
      if (suppressed > 0) {
        result[reason] = suppressed;
      }
    }
    return result;
  };

  const uniqueAll = getUniqueOpenedCounts(allTimeBucket.records);
  const uniqueLast7 = getUniqueOpenedCounts(last7Bucket.records);

  const timingDurations = getTimeToStartDurations(allTimeBucket.records);
  const overallTimingSorted = [...timingDurations.overall].sort((a, b) => a - b);
  const timingByTrigger = Array.from(timingDurations.byTrigger.entries()).map(
    ([trigger, values]) => ({
      trigger,
      medianSeconds: medianSeconds(values),
      count: values.length,
    })
  );
  const timingByVariant = Array.from(timingDurations.byVariant.entries()).map(
    ([paywallVariant, values]) => ({
      paywallVariant,
      medianSeconds: medianSeconds(values),
      count: values.length,
    })
  );

  const shownTotal = sumEvents(allTimeBucket.events, 'trigger_shown');
  const openedTotal = sumEvents(allTimeBucket.events, 'paywall_opened');
  const mismatchMap = new Map<string, { dayKey: string; trigger: string; placement: string; shown: number; opened: number }>();
  for (const record of allTimeBucket.records) {
    if (record.event !== 'trigger_shown' && record.event !== 'paywall_opened') continue;
    const key = `${record.dayKey}|${record.trigger ?? 'unknown'}|${record.placement ?? 'unknown'}`;
    const existing =
      mismatchMap.get(key) ??
      {
        dayKey: record.dayKey,
        trigger: record.trigger ?? 'unknown',
        placement: record.placement ?? 'unknown',
        shown: 0,
        opened: 0,
      };
    if (record.event === 'trigger_shown') {
      existing.shown += 1;
    } else {
      existing.opened += 1;
    }
    mismatchMap.set(key, existing);
  }
  const mismatchRows = Array.from(mismatchMap.values())
    .map((row) => ({
      dayKey: row.dayKey,
      trigger: row.trigger,
      placement: row.placement,
      diff: row.shown - row.opened,
    }))
    .filter((row) => row.diff > 0)
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
      return b.diff - a.diff;
    })
    .slice(0, 10);

  const leaderboard = triggerKeys
    .map((trigger) => {
      const counts = allTimeBucket.byTrigger[trigger] ?? {};
      const eligible = sumEvents(counts, 'trigger_eligible');
      const shown = sumEvents(counts, 'trigger_shown');
      const started = sumEvents(counts, 'start_purchase');
      const uniqueOpened = uniqueAll.byTrigger.get(trigger) ?? 0;
      return {
        trigger,
        eligible,
        shown,
        uniqueOpened,
        started,
        startRate: rate(started, uniqueOpened),
      };
    })
    .filter((row) => row.uniqueOpened >= 5)
    .sort((a, b) => {
      if (b.startRate !== a.startRate) return b.startRate - a.startRate;
      return b.uniqueOpened - a.uniqueOpened;
    });

  const byVariant = Object.entries(allTimeBucket.byVariant)
    .map(([paywallVariant, counts]) => {
      const opened = sumEvents(counts, 'paywall_opened');
      const start = sumEvents(counts, 'start_purchase');
      const success = sumEvents(counts, 'purchase_success');
      const uniqueOpened = uniqueAll.byVariant.get(paywallVariant) ?? 0;
      const timing = timingByVariant.find((row) => row.paywallVariant === paywallVariant);
      return {
        paywallVariant,
        uniqueOpened,
        opened,
        start,
        success,
        startRate: rate(start, uniqueOpened),
        successRate: rate(success, start),
        medianTimeToStartSeconds: timing?.medianSeconds ?? 0,
      };
    })
    .filter((row) => row.opened > 0 || row.start > 0 || row.uniqueOpened > 0);

  return {
    triggerReach: {
      allTime: triggerRowsFromBucket(allTimeBucket),
      last7d: triggerRowsFromBucket(last7Bucket),
    },
    paywallEngagement: {
      total: {
        opened: paywallOpenedAll,
        start: startPurchaseAll,
        startRate: rate(startPurchaseAll, paywallOpenedAll),
      },
      byTrigger: byTriggerEngagement,
      byPlacement: byPlacementEngagement,
    },
    purchaseOutcomes: {
      total: {
        start: totalStart,
        success: totalSuccess,
        cancel: totalCancel,
        fail: totalFail,
        successRate: rate(totalSuccess, totalStart),
        cancelRate: rate(totalCancel, totalStart),
        failRate: rate(totalFail, totalStart),
      },
      byTrigger: purchaseByTrigger,
    },
    suppression: {
      allTimeByReason: suppressionFromBucket(allTimeBucket),
      last7dByReason: suppressionFromBucket(last7Bucket),
    },
    byVariant,
    uniqueOpens: {
      allTime: uniqueAll.total,
      last7d: uniqueLast7.total,
      byTriggerAllTime: Array.from(uniqueAll.byTrigger.entries()).map(([trigger, uniqueOpened]) => ({
        trigger,
        uniqueOpened,
      })),
      byTriggerLast7d: Array.from(uniqueLast7.byTrigger.entries()).map(([trigger, uniqueOpened]) => ({
        trigger,
        uniqueOpened,
      })),
    },
    timing: {
      overallMedianSeconds: medianSeconds(timingDurations.overall),
      overallP90Seconds: percentile(overallTimingSorted, 90),
      byTrigger: timingByTrigger,
    },
    integrity: {
      triggersShown: shownTotal,
      paywallOpened: openedTotal,
      mismatch: shownTotal - openedTotal,
      mismatches: mismatchRows,
    },
    leaderboard,
  };
}
