import {
  calculateLevainPlan,
  computeCoachPhase,
  getPlannerPeakHours,
  getUpdatedBaselinePeakHours,
  parseLevainStartReadyBy,
  parseLevainStartNote,
} from '../utils/levainPlanner';

describe('getPlannerPeakHours', () => {
  it('uses baseline peak when available', () => {
    expect(getPlannerPeakHours({ baseline_peak_hours: 6, default_feed_interval_hours: 12 })).toBe(6);
  });

  it('falls back to default feed interval', () => {
    expect(getPlannerPeakHours({ baseline_peak_hours: null, default_feed_interval_hours: 10 })).toBe(10);
  });

  it('falls back to 8 hours', () => {
    expect(getPlannerPeakHours({ baseline_peak_hours: null, default_feed_interval_hours: null })).toBe(8);
  });
});

describe('calculateLevainPlan', () => {
  it('keeps total exact and computes start time', () => {
    const readyBy = new Date('2026-01-01T20:00:00.000Z');
    const result = calculateLevainPlan({
      desired_total_g: 200,
      hydration_percent: 100,
      ratio_a: 1,
      ratio_b: 3,
      ratio_c: 3,
      estimated_peak_hours: 8,
      ready_by: readyBy,
    });

    expect(result.starter_g + result.flour_g + result.water_g).toBe(200);
    expect(result.start_at.toISOString()).toBe('2026-01-01T12:00:00.000Z');
  });

  it('prioritizes hydration and total when ratio conflicts', () => {
    const readyBy = new Date('2026-01-01T20:00:00.000Z');
    const result = calculateLevainPlan({
      desired_total_g: 180,
      hydration_percent: 125,
      ratio_a: 1,
      ratio_b: 3,
      ratio_c: 3,
      estimated_peak_hours: 9,
      ready_by: readyBy,
    });

    expect(result.starter_g + result.flour_g + result.water_g).toBe(180);
    expect(result.water_g).toBeGreaterThan(result.flour_g);
    expect(result.ratio_string.startsWith('1:')).toBe(true);
  });
});

describe('planner learning helpers', () => {
  it('parses levain start note prefix', () => {
    const iso = '2026-02-19T17:12:00.000Z';
    const parsed = parseLevainStartNote(`LEV_START|${iso}|READY_BY|2026-02-20T01:12:00.000Z`);
    expect(parsed?.toISOString()).toBe(iso);
  });

  it('applies rolling baseline average', () => {
    expect(getUpdatedBaselinePeakHours(8, 10)).toBe(8.5);
    expect(getUpdatedBaselinePeakHours(null, 9.876)).toBe(9.88);
  });

  it('parses levain start + ready by notes', () => {
    const parsed = parseLevainStartReadyBy(
      'LEV_START|2026-02-19T17:12:00.000Z|READY_BY|2026-02-20T01:12:00.000Z'
    );
    expect(parsed?.startAt.toISOString()).toBe('2026-02-19T17:12:00.000Z');
    expect(parsed?.readyBy.toISOString()).toBe('2026-02-20T01:12:00.000Z');
  });

  it('computes warming up phase', () => {
    const readyBy = new Date('2026-02-20T10:00:00.000Z');
    const result = computeCoachPhase({
      now: new Date('2026-02-20T08:00:00.000Z').getTime(),
      startAt: new Date('2026-02-20T02:00:00.000Z'),
      readyBy,
      estimatedPeakHours: 8,
    });
    expect(result.phase).toBe('warming_up');
  });

  it('computes in peak window phase', () => {
    const readyBy = new Date('2026-02-20T10:00:00.000Z');
    const result = computeCoachPhase({
      now: new Date('2026-02-20T09:45:00.000Z').getTime(),
      startAt: new Date('2026-02-20T02:00:00.000Z'),
      readyBy,
      estimatedPeakHours: 8,
    });
    expect(result.phase).toBe('in_peak_window');
  });

  it('computes ready now phase at ready by boundary', () => {
    const readyBy = new Date('2026-02-20T10:00:00.000Z');
    const result = computeCoachPhase({
      now: readyBy.getTime(),
      startAt: new Date('2026-02-20T02:00:00.000Z'),
      readyBy,
      estimatedPeakHours: 8,
    });
    expect(result.phase).toBe('ready_now');
  });
});
