export interface LevainPlanInput {
  desired_total_g: number;
  hydration_percent: number;
  ratio_a: number;
  ratio_b: number;
  ratio_c: number;
  estimated_peak_hours: number;
  ready_by: Date;
}

export interface LevainPlanResult {
  starter_g: number;
  flour_g: number;
  water_g: number;
  ratio_string: string;
  estimated_peak_hours: number;
  start_at: Date;
  ready_by: Date;
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function formatRatioPart(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

export function getPlannerPeakHours(starter?: {
  baseline_peak_hours?: number | null;
  default_feed_interval_hours?: number | null;
} | null): number {
  if (starter?.baseline_peak_hours && starter.baseline_peak_hours > 0) {
    return starter.baseline_peak_hours;
  }
  if (starter?.default_feed_interval_hours && starter.default_feed_interval_hours > 0) {
    return starter.default_feed_interval_hours;
  }
  return 8;
}

export function calculateLevainPlan(input: LevainPlanInput): LevainPlanResult {
  const desiredTotal = Math.max(0, Math.round(input.desired_total_g));
  const ratioA = clampPositive(input.ratio_a, 1);
  const ratioB = clampPositive(input.ratio_b, 1);
  const ratioC = clampPositive(input.ratio_c, 1);
  const hydration = Math.max(1, input.hydration_percent);

  const totalParts = ratioA + ratioB + ratioC;
  const starterRaw = totalParts > 0 ? desiredTotal * (ratioA / totalParts) : desiredTotal;
  const starter_g = Math.round(starterRaw);

  const remaining = Math.max(0, desiredTotal - starter_g);
  const hydrationFactor = hydration / 100;
  const flourRaw = remaining / (1 + hydrationFactor);
  let flour_g = Math.round(flourRaw);
  let water_g = remaining - flour_g;

  // Keep total exact after rounding.
  const correction = desiredTotal - (starter_g + flour_g + water_g);
  if (correction !== 0) {
    water_g += correction;
  }

  if (water_g < 0) {
    flour_g = Math.max(0, flour_g + water_g);
    water_g = 0;
  }

  const flourRatio = starter_g > 0 ? flour_g / starter_g : 0;
  const waterRatio = starter_g > 0 ? water_g / starter_g : 0;
  const ratio_string = starter_g > 0
    ? `1:${formatRatioPart(flourRatio)}:${formatRatioPart(waterRatio)}`
    : '0:0:0';

  const estimated_peak_hours = clampPositive(input.estimated_peak_hours, 8);
  const start_at = new Date(input.ready_by.getTime() - estimated_peak_hours * 60 * 60 * 1000);

  return {
    starter_g,
    flour_g,
    water_g,
    ratio_string,
    estimated_peak_hours,
    start_at,
    ready_by: input.ready_by,
  };
}

export function parseLevainStartNote(notes: string | null | undefined): Date | null {
  if (!notes || !notes.startsWith('LEV_START|')) return null;
  const parts = notes.split('|');
  const isoStart = parts[1];
  if (!isoStart) return null;

  const parsed = new Date(isoStart);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseLevainStartReadyBy(
  notes: string | null | undefined
): { startAt: Date; readyBy: Date } | null {
  if (!notes || !notes.startsWith('LEV_START|')) return null;
  const firstLine = notes.split('\n')[0] ?? notes;
  const parts = firstLine.split('|');
  if (parts.length < 4) return null;

  const startAt = new Date(parts[1]);
  const readyBy = new Date(parts[3]);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(readyBy.getTime())) {
    return null;
  }
  return { startAt, readyBy };
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function computeCoachPhase(input: {
  now: number;
  startAt: Date;
  readyBy: Date;
  estimatedPeakHours: number;
}): {
  peakWindowStart: Date;
  peakWindowEnd: Date;
  phase: 'warming_up' | 'in_peak_window' | 'ready_now' | 'past_peak_window';
  statusLabel: string;
  nextLabel: string;
} {
  const peakWindowStart = new Date(input.readyBy.getTime() - 30 * 60 * 1000);
  const peakWindowEnd = new Date(input.readyBy.getTime() + 30 * 60 * 1000);

  if (input.now < peakWindowStart.getTime()) {
    return {
      peakWindowStart,
      peakWindowEnd,
      phase: 'warming_up',
      statusLabel: 'Warming up',
      nextLabel: `Peak window at ${formatClock(peakWindowStart)}`,
    };
  }

  if (input.now >= input.readyBy.getTime()) {
    return {
      peakWindowStart,
      peakWindowEnd,
      phase: 'ready_now',
      statusLabel: 'Ready',
      nextLabel: 'Use now',
    };
  }

  if (input.now >= peakWindowStart.getTime() && input.now <= peakWindowEnd.getTime()) {
    return {
      peakWindowStart,
      peakWindowEnd,
      phase: 'in_peak_window',
      statusLabel: 'In peak window',
      nextLabel: 'Use now',
    };
  }

  return {
    peakWindowStart,
    peakWindowEnd,
    phase: 'past_peak_window',
    statusLabel: 'Past peak window',
    nextLabel: 'Use if still strong',
  };
}

export function getUpdatedBaselinePeakHours(
  currentBaseline: number | null | undefined,
  observedHours: number
): number {
  const next = currentBaseline && currentBaseline > 0
    ? (currentBaseline * 3 + observedHours) / 4
    : observedHours;
  return Math.round(next * 100) / 100;
}
