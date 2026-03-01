const mockFiles = new Map<string, string>();

jest.mock('expo-file-system', () => {
  class File {
    private readonly path: string;

    constructor(...parts: string[]) {
      this.path = parts.join('/');
    }

    async text(): Promise<string> {
      if (!mockFiles.has(this.path)) {
        throw new Error('ENOENT');
      }
      return mockFiles.get(this.path) ?? '';
    }

    async create(): Promise<void> {
      if (!mockFiles.has(this.path)) {
        mockFiles.set(this.path, '');
      }
    }

    async write(value: string): Promise<void> {
      mockFiles.set(this.path, value);
    }
  }

  return {
    File,
    Paths: {
      document: '/mock-document',
    },
  };
});

import { File, Paths } from 'expo-file-system';
import {
  computeConversionChecks,
  getFunnelSnapshot,
  resetFunnel,
  trackFunnel,
} from '../services/upgradeFunnel';

describe('upgradeFunnel', () => {
  beforeEach(async () => {
    mockFiles.clear();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
    await resetFunnel();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks events by day and all-time', async () => {
    await trackFunnel('trigger_eligible', { trigger: 'analytics_opened_locked', placement: 'trigger' });
    await trackFunnel('trigger_shown', { trigger: 'analytics_opened_locked', placement: 'trigger' });

    const snapshot = await getFunnelSnapshot();
    expect(snapshot.today.events.trigger_eligible).toBe(1);
    expect(snapshot.today.events.trigger_shown).toBe(1);
    expect(snapshot.allTime.events.trigger_eligible).toBe(1);
    expect(snapshot.allTime.byTrigger.analytics_opened_locked?.trigger_shown).toBe(1);
  });

  it('increments all-time across different days', async () => {
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    jest.setSystemTime(new Date('2026-02-27T12:00:00.000Z'));
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });

    const snapshot = await getFunnelSnapshot();
    expect(snapshot.allTime.events.paywall_opened).toBe(2);
    expect(Object.keys(snapshot.byDay).length).toBe(2);
  });

  it('recovers from corrupted storage content', async () => {
    const file = new File(Paths.document, 'upgrade-funnel.json');
    await file.create({ overwrite: true } as never);
    await file.write('{not-json');

    await trackFunnel('restore_started', { placement: 'paywall' });
    const snapshot = await getFunnelSnapshot();
    expect(snapshot.today.events.restore_started).toBe(1);
    expect(snapshot.allTime.events.restore_started).toBe(1);
  });

  it('tracks trigger_suppressed by reason', async () => {
    await trackFunnel('trigger_suppressed', {
      trigger: 'analytics_opened_locked',
      placement: 'trigger',
      reason: 'globalCooldown',
    });

    const snapshot = await getFunnelSnapshot();
    expect(snapshot.today.events.trigger_suppressed).toBe(1);
    expect(snapshot.allTime.byReason.globalCooldown?.trigger_suppressed).toBe(1);
  });

  it('computes conversion checks rates', async () => {
    await trackFunnel('trigger_eligible', { trigger: 'analytics_opened_locked', placement: 'trigger' });
    await trackFunnel('trigger_shown', { trigger: 'analytics_opened_locked', placement: 'trigger' });
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    await trackFunnel('start_purchase', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    await trackFunnel('purchase_success', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    await trackFunnel('trigger_suppressed', {
      trigger: 'analytics_opened_locked',
      placement: 'trigger',
      reason: 'sessionThrottle',
    });

    const snapshot = await getFunnelSnapshot();
    const checks = computeConversionChecks(snapshot);

    expect(checks.triggerReach.allTime[0]).toMatchObject({
      trigger: 'analytics_opened_locked',
      eligible: 1,
      shown: 1,
      shownRate: 1,
    });
    expect(checks.paywallEngagement.total).toMatchObject({
      opened: 1,
      start: 1,
      startRate: 1,
    });
    expect(checks.purchaseOutcomes.total).toMatchObject({
      start: 1,
      success: 1,
      cancel: 0,
      fail: 0,
      successRate: 1,
      cancelRate: 0,
      failRate: 0,
    });
    expect(checks.suppression.allTimeByReason.sessionThrottle).toBe(1);
  });

  it('dedupes unique paywall opens by day + trigger + session', async () => {
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });

    const snapshot = await getFunnelSnapshot();
    const checks = computeConversionChecks(snapshot);
    expect(snapshot.allTime.events.paywall_opened).toBe(2);
    expect(checks.uniqueOpens.allTime).toBe(1);
    expect(checks.uniqueOpens.byTriggerAllTime.find((row) => row.trigger === 'analytics_opened_locked')?.uniqueOpened).toBe(1);
  });

  it('computes timing median and p90 from paywall_opened -> start_purchase', async () => {
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall' });
    jest.setSystemTime(new Date('2026-02-26T12:00:10.000Z'));
    await trackFunnel('start_purchase', { trigger: 'analytics_opened_locked', placement: 'paywall' });

    jest.setSystemTime(new Date('2026-02-26T12:01:00.000Z'));
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall', sessionId: 'manual-session-2' });
    jest.setSystemTime(new Date('2026-02-26T12:01:40.000Z'));
    await trackFunnel('start_purchase', { trigger: 'analytics_opened_locked', placement: 'paywall', sessionId: 'manual-session-2' });

    jest.setSystemTime(new Date('2026-02-26T12:02:00.000Z'));
    await trackFunnel('paywall_opened', { trigger: 'analytics_opened_locked', placement: 'paywall', sessionId: 'manual-session-3' });
    jest.setSystemTime(new Date('2026-02-26T12:03:30.000Z'));
    await trackFunnel('start_purchase', { trigger: 'analytics_opened_locked', placement: 'paywall', sessionId: 'manual-session-3' });

    const checks = computeConversionChecks(await getFunnelSnapshot());
    expect(checks.timing.overallMedianSeconds).toBe(40);
    expect(checks.timing.overallP90Seconds).toBe(90);
  });

  it('filters leaderboard to triggers with uniqueOpened >= 5', async () => {
    for (let i = 0; i < 5; i += 1) {
      await trackFunnel('paywall_opened', {
        trigger: 'analytics_opened_locked',
        placement: 'paywall',
        sessionId: `leader-${i}`,
      });
      await trackFunnel('start_purchase', {
        trigger: 'analytics_opened_locked',
        placement: 'paywall',
        sessionId: `leader-${i}`,
      });
      await trackFunnel('trigger_eligible', { trigger: 'analytics_opened_locked', placement: 'trigger' });
      await trackFunnel('trigger_shown', { trigger: 'analytics_opened_locked', placement: 'trigger' });
    }

    for (let i = 0; i < 4; i += 1) {
      await trackFunnel('paywall_opened', {
        trigger: 'multi_culture_locked_action',
        placement: 'paywall',
        sessionId: `short-${i}`,
      });
      await trackFunnel('start_purchase', {
        trigger: 'multi_culture_locked_action',
        placement: 'paywall',
        sessionId: `short-${i}`,
      });
    }

    const checks = computeConversionChecks(await getFunnelSnapshot());
    expect(checks.leaderboard.some((row) => row.trigger === 'analytics_opened_locked')).toBe(true);
    expect(checks.leaderboard.some((row) => row.trigger === 'multi_culture_locked_action')).toBe(false);
  });

  it('computes byVariant metrics', async () => {
    await trackFunnel('paywall_opened', {
      trigger: 'analytics_opened_locked',
      placement: 'paywall',
      paywallVariant: 'v1',
      sessionId: 'v1-a',
    });
    await trackFunnel('start_purchase', {
      trigger: 'analytics_opened_locked',
      placement: 'paywall',
      paywallVariant: 'v1',
      sessionId: 'v1-a',
    });
    await trackFunnel('purchase_success', {
      trigger: 'analytics_opened_locked',
      placement: 'paywall',
      paywallVariant: 'v1',
      sessionId: 'v1-a',
    });
    await trackFunnel('paywall_opened', {
      trigger: 'analytics_opened_locked',
      placement: 'paywall',
      paywallVariant: 'v2',
      sessionId: 'v2-a',
    });

    const checks = computeConversionChecks(await getFunnelSnapshot());
    const v1 = checks.byVariant.find((row) => row.paywallVariant === 'v1');
    const v2 = checks.byVariant.find((row) => row.paywallVariant === 'v2');
    expect(v1).toMatchObject({
      uniqueOpened: 1,
      opened: 1,
      start: 1,
      success: 1,
      startRate: 1,
      successRate: 1,
    });
    expect(v2).toMatchObject({
      uniqueOpened: 1,
      opened: 1,
      start: 0,
      success: 0,
      startRate: 0,
      successRate: 0,
    });
  });

  it('normalizes trigger and placement keys before aggregating', async () => {
    await trackFunnel('trigger_eligible', {
      trigger: ' Analytics_Opened_Locked ',
      placement: ' Trigger ',
      paywallVariant: ' V1 ',
      packageId: '  monthly.pkg  ',
    });
    await trackFunnel('trigger_shown', {
      trigger: 'analytics_opened_locked',
      placement: 'trigger',
      paywallVariant: 'v1',
      packageId: 'monthly.pkg',
    });

    const snapshot = await getFunnelSnapshot();
    expect(snapshot.allTime.byTrigger.analytics_opened_locked?.trigger_eligible).toBe(1);
    expect(snapshot.allTime.byTrigger.analytics_opened_locked?.trigger_shown).toBe(1);
    expect(snapshot.allTime.byPlacement.trigger?.trigger_eligible).toBe(1);
    expect(snapshot.allTime.byVariant.v1?.trigger_eligible).toBe(1);
    expect(snapshot.allTime.byPackage['monthly.pkg']?.trigger_eligible).toBe(1);
  });

  it('caps stored records to most recent 500 entries', async () => {
    for (let i = 0; i < 550; i += 1) {
      await trackFunnel('paywall_opened', {
        trigger: 'analytics_opened_locked',
        placement: 'paywall',
        packageId: `pkg-${i}`,
      });
    }

    const snapshot = await getFunnelSnapshot();
    expect(snapshot.allTime.records.length).toBe(500);
    expect(snapshot.today.records.length).toBe(500);
    const lastRecord = snapshot.allTime.records[snapshot.allTime.records.length - 1];
    expect(lastRecord.packageId).toBe('pkg-549');
    const firstRecord = snapshot.allTime.records[0];
    expect(firstRecord.packageId).toBe('pkg-50');
  });
});
