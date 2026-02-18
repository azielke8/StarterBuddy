import { FeedCalculation } from '../models/types';

/**
 * Map target peak hours to suggested ratio using heuristic table.
 * Returns [a, b, c] where a:b:c represents starter:flour:water.
 */
export function suggestRatioForHours(targetHours: number): [number, number, number] {
  if (targetHours <= 4) return [1, 1, 1];
  if (targetHours <= 6) return [1, 2, 2];
  if (targetHours <= 9) return [1, 3, 3];
  if (targetHours <= 12) return [1, 4, 4];
  return [1, 5, 5];
}

/**
 * Estimate peak hours from ratio.
 * Inverse of the suggest function — given a ratio, approximate time to peak.
 */
export function estimatePeakHoursFromRatio(
  ratioA: number,
  ratioB: number,
  baselinePeakHours?: number | null
): number {
  const feedRatio = ratioB / Math.max(ratioA, 1);

  // Base estimate from ratio
  let estimate: number;
  if (feedRatio <= 1) estimate = 3.5;
  else if (feedRatio <= 2) estimate = 5.5;
  else if (feedRatio <= 3) estimate = 8;
  else if (feedRatio <= 4) estimate = 11;
  else estimate = 13;

  // If baseline exists, blend toward it (the baseline captures this starter's behavior)
  if (baselinePeakHours != null && baselinePeakHours > 0) {
    // Weight: 60% heuristic, 40% baseline (since ratio changes matter)
    estimate = estimate * 0.6 + baselinePeakHours * 0.4;
  }

  return Math.round(estimate * 10) / 10;
}

/**
 * Calculate feed amounts based on desired final weight, hydration, and ratio.
 */
export function calculateFeed(
  desiredTotal: number,
  hydrationPercent: number,
  ratioA: number,
  ratioB: number,
  ratioC: number,
  baselinePeakHours?: number | null
): FeedCalculation {
  const totalParts = ratioA + ratioB + ratioC;
  const starterPart = ratioA / totalParts;
  const flourPart = ratioB / totalParts;
  const waterPart = ratioC / totalParts;

  const starter_g = Math.round(desiredTotal * starterPart);
  const flour_g = Math.round(desiredTotal * flourPart);
  const water_g = Math.round(desiredTotal * waterPart);

  const ratio_string = `${ratioA}:${ratioB}:${ratioC}`;
  const estimated_peak_hours = estimatePeakHoursFromRatio(ratioA, ratioB, baselinePeakHours);

  return {
    starter_g,
    flour_g,
    water_g,
    ratio_string,
    estimated_peak_hours,
  };
}

/**
 * Check if a suggested ratio differs meaningfully from the user's preferred ratio.
 * Returns the suggestion only if different.
 */
export function getSuggestionIfDifferent(
  targetHours: number,
  preferredA: number,
  preferredB: number,
  preferredC: number
): { ratio: [number, number, number]; hours: number } | null {
  const suggested = suggestRatioForHours(targetHours);
  // Compare — we consider ratios meaningfully different if b or c differ
  if (suggested[1] === preferredB && suggested[2] === preferredC) {
    return null; // Aligned — show nothing
  }
  return { ratio: suggested, hours: targetHours };
}

/**
 * Compute rolling average of confirmed peak hours.
 * Uses last N confirmed peaks to update the baseline.
 */
export function computeRollingAveragePeak(confirmedPeakHours: number[]): number | null {
  if (confirmedPeakHours.length === 0) return null;
  const sum = confirmedPeakHours.reduce((acc, h) => acc + h, 0);
  return Math.round((sum / confirmedPeakHours.length) * 10) / 10;
}

/**
 * Format a number of hours into a human-readable duration.
 */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Compute estimated peak time from a feed timestamp and estimated peak hours.
 * Returns a Date.
 */
export function computePeakTime(feedTimestamp: string, estimatedPeakHours: number): Date {
  const feedTime = new Date(feedTimestamp);
  return new Date(feedTime.getTime() + estimatedPeakHours * 60 * 60 * 1000);
}

/**
 * Determine the peak status relative to now.
 */
export function getPeakStatus(
  feedTimestamp: string,
  estimatedPeakHours: number
): 'before' | 'within' | 'past' {
  const now = new Date();
  const peakTime = computePeakTime(feedTimestamp, estimatedPeakHours);
  // Window: peakTime - 30min to peakTime + 60min
  const windowStart = new Date(peakTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(peakTime.getTime() + 60 * 60 * 1000);

  if (now < windowStart) return 'before';
  if (now <= windowEnd) return 'within';
  return 'past';
}

/**
 * Get time remaining until peak (or time since peak window ended).
 */
export function getTimeUntilPeak(feedTimestamp: string, estimatedPeakHours: number): string {
  const now = new Date();
  const peakTime = computePeakTime(feedTimestamp, estimatedPeakHours);
  const diffMs = peakTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours > 0) {
    return `Peak in ${formatDuration(diffHours)}`;
  }
  return `Past optimal window`;
}
