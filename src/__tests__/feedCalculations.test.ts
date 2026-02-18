import {
  suggestRatioForHours,
  estimatePeakHoursFromRatio,
  calculateFeed,
  getSuggestionIfDifferent,
  computeRollingAveragePeak,
  formatDuration,
  getPeakStatus,
} from '../utils/feedCalculations';

describe('suggestRatioForHours', () => {
  it('suggests 1:1:1 for 3-4 hour target', () => {
    expect(suggestRatioForHours(3)).toEqual([1, 1, 1]);
    expect(suggestRatioForHours(4)).toEqual([1, 1, 1]);
  });

  it('suggests 1:2:2 for 5-6 hour target', () => {
    expect(suggestRatioForHours(5)).toEqual([1, 2, 2]);
    expect(suggestRatioForHours(6)).toEqual([1, 2, 2]);
  });

  it('suggests 1:3:3 for 7-9 hour target', () => {
    expect(suggestRatioForHours(7)).toEqual([1, 3, 3]);
    expect(suggestRatioForHours(9)).toEqual([1, 3, 3]);
  });

  it('suggests 1:4:4 for 10-12 hour target', () => {
    expect(suggestRatioForHours(10)).toEqual([1, 4, 4]);
    expect(suggestRatioForHours(12)).toEqual([1, 4, 4]);
  });

  it('suggests 1:5:5 for 12+ hour target', () => {
    expect(suggestRatioForHours(13)).toEqual([1, 5, 5]);
    expect(suggestRatioForHours(24)).toEqual([1, 5, 5]);
  });

  it('suggests 1:1:1 for very short targets', () => {
    expect(suggestRatioForHours(1)).toEqual([1, 1, 1]);
    expect(suggestRatioForHours(2)).toEqual([1, 1, 1]);
  });
});

describe('estimatePeakHoursFromRatio', () => {
  it('estimates ~3.5h for 1:1 ratio', () => {
    expect(estimatePeakHoursFromRatio(1, 1)).toBe(3.5);
  });

  it('estimates ~5.5h for 1:2 ratio', () => {
    expect(estimatePeakHoursFromRatio(1, 2)).toBe(5.5);
  });

  it('estimates ~8h for 1:3 ratio', () => {
    expect(estimatePeakHoursFromRatio(1, 3)).toBe(8);
  });

  it('estimates ~11h for 1:4 ratio', () => {
    expect(estimatePeakHoursFromRatio(1, 4)).toBe(11);
  });

  it('estimates ~13h for 1:5 ratio', () => {
    expect(estimatePeakHoursFromRatio(1, 5)).toBe(13);
  });

  it('blends with baseline when provided', () => {
    // 1:3 gives ~8h heuristic. Baseline is 6h.
    // 0.6 * 8 + 0.4 * 6 = 4.8 + 2.4 = 7.2
    const result = estimatePeakHoursFromRatio(1, 3, 6);
    expect(result).toBe(7.2);
  });

  it('ignores null baseline', () => {
    expect(estimatePeakHoursFromRatio(1, 3, null)).toBe(8);
  });

  it('ignores zero baseline', () => {
    expect(estimatePeakHoursFromRatio(1, 3, 0)).toBe(8);
  });
});

describe('calculateFeed', () => {
  it('calculates correct amounts for 1:3:3 ratio with 210g total', () => {
    const result = calculateFeed(210, 100, 1, 3, 3);
    expect(result.starter_g).toBe(30);
    expect(result.flour_g).toBe(90);
    expect(result.water_g).toBe(90);
    expect(result.ratio_string).toBe('1:3:3');
  });

  it('calculates correct amounts for 1:1:1 ratio with 150g total', () => {
    const result = calculateFeed(150, 100, 1, 1, 1);
    expect(result.starter_g).toBe(50);
    expect(result.flour_g).toBe(50);
    expect(result.water_g).toBe(50);
    expect(result.ratio_string).toBe('1:1:1');
  });

  it('includes estimated peak hours', () => {
    const result = calculateFeed(210, 100, 1, 3, 3);
    expect(result.estimated_peak_hours).toBeGreaterThan(0);
  });

  it('rounds amounts to whole numbers', () => {
    const result = calculateFeed(100, 100, 1, 3, 3);
    expect(Number.isInteger(result.starter_g)).toBe(true);
    expect(Number.isInteger(result.flour_g)).toBe(true);
    expect(Number.isInteger(result.water_g)).toBe(true);
  });
});

describe('getSuggestionIfDifferent', () => {
  it('returns null when ratio matches suggestion', () => {
    // 8h target -> 1:3:3 suggested. Preferred is 1:3:3.
    expect(getSuggestionIfDifferent(8, 1, 3, 3)).toBeNull();
  });

  it('returns suggestion when ratio differs', () => {
    // 8h target -> 1:3:3 suggested. Preferred is 1:5:5.
    const result = getSuggestionIfDifferent(8, 1, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.ratio).toEqual([1, 3, 3]);
  });

  it('returns null when ratio a differs but b,c match', () => {
    // Only b and c matter for comparison
    const result = getSuggestionIfDifferent(8, 2, 3, 3);
    expect(result).toBeNull();
  });
});

describe('computeRollingAveragePeak', () => {
  it('returns null for empty array', () => {
    expect(computeRollingAveragePeak([])).toBeNull();
  });

  it('returns the single value for one element', () => {
    expect(computeRollingAveragePeak([6.5])).toBe(6.5);
  });

  it('computes average correctly', () => {
    expect(computeRollingAveragePeak([6, 8, 7])).toBe(7);
  });

  it('rounds to one decimal place', () => {
    expect(computeRollingAveragePeak([6, 7])).toBe(6.5);
  });

  it('handles many confirmed peaks', () => {
    const peaks = [5, 6, 7, 8, 9, 10, 5, 6, 7, 8];
    const avg = peaks.reduce((a, b) => a + b, 0) / peaks.length;
    expect(computeRollingAveragePeak(peaks)).toBe(Math.round(avg * 10) / 10);
  });
});

describe('formatDuration', () => {
  it('formats hours only', () => {
    expect(formatDuration(5)).toBe('5h');
  });

  it('formats minutes only', () => {
    expect(formatDuration(0.5)).toBe('30m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(2.5)).toBe('2h 30m');
  });

  it('formats zero as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('getPeakStatus', () => {
  it('returns "before" when peak is far away', () => {
    const feedTime = new Date();
    const result = getPeakStatus(feedTime.toISOString(), 10);
    expect(result).toBe('before');
  });

  it('returns "past" when window has passed', () => {
    const feedTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
    const result = getPeakStatus(feedTime.toISOString(), 8);
    expect(result).toBe('past');
  });
});
