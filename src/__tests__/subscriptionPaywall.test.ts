import {
  getPackageTypeKey,
  pickMonthlyAndYearlyPackages,
  hasActiveEntitlement,
  isPurchaseCanceledError,
  computeYearlyValueSignal,
} from '../utils/subscriptionPaywall';

describe('subscriptionPaywall helpers', () => {
  it('detects package type keys and falls back to identifier heuristics', () => {
    const offerings = [
      { identifier: 'starter.monthly', packageType: 'MONTHLY' },
      { identifier: 'starter.yearly', packageType: 'ANNUAL' },
      { identifier: 'starter.alt_month', packageType: 123 },
      { identifier: 'starter.annual_special', packageType: null },
    ];

    expect(getPackageTypeKey(offerings[0])).toBe('monthly');
    expect(getPackageTypeKey(offerings[2])).toBe('123');
    expect(getPackageTypeKey(offerings[3])).toBe('');

    const picked = pickMonthlyAndYearlyPackages(offerings);
    expect(picked.monthly?.identifier).toBe('starter.monthly');
    expect(picked.yearly?.identifier).toBe('starter.yearly');
    expect(!!(picked.monthly && picked.yearly)).toBe(true);
  });

  it('falls back to identifier when packageType is missing', () => {
    const offerings = [
      { identifier: 'foo_month_plan' },
      { identifier: 'foo_annual_plan' },
    ];
    const picked = pickMonthlyAndYearlyPackages(offerings);
    expect(picked.monthly?.identifier).toBe('foo_month_plan');
    expect(picked.yearly?.identifier).toBe('foo_annual_plan');
  });

  it('detects active entitlements from both result shapes', () => {
    expect(
      hasActiveEntitlement({
        customerInfo: { entitlements: { active: { pro: {} } } },
      })
    ).toBe(true);
    expect(
      hasActiveEntitlement({
        entitlements: { active: { pro: {} } },
      })
    ).toBe(true);
    expect(hasActiveEntitlement({})).toBe(false);
    expect(hasActiveEntitlement({ customerInfo: { entitlements: { active: {} } } })).toBe(false);
  });

  it('detects purchase canceled errors', () => {
    expect(isPurchaseCanceledError({ userCancelled: true })).toBe(true);
    expect(isPurchaseCanceledError({ code: 'USER_CANCELLED' })).toBe(true);
    expect(isPurchaseCanceledError({ code: 'PurchaseCancelledError' })).toBe(true);
    expect(isPurchaseCanceledError({ code: 'NETWORK_ERROR' })).toBe(false);
    expect(isPurchaseCanceledError(new Error('oops'))).toBe(false);
  });

  it('computes yearly value signal safely', () => {
    expect(computeYearlyValueSignal(9.99, 89.99)).toEqual({
      monthlyEquivalent: 89.99 / 12,
      savePercent: Math.round(((9.99 - 89.99 / 12) / 9.99) * 100),
    });
    expect(computeYearlyValueSignal(null, 89.99)).toEqual({
      monthlyEquivalent: 89.99 / 12,
      savePercent: undefined,
    });
    expect(computeYearlyValueSignal(9.99, 0)).toEqual({});
    expect(computeYearlyValueSignal(9.99, -10)).toEqual({});
    expect(computeYearlyValueSignal(undefined, undefined)).toEqual({});
  });
});
