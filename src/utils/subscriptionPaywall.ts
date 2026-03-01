type PackageLike = {
  identifier?: string;
  packageType?: unknown;
};

export function getPackageTypeKey(pkg: PackageLike): string {
  const packageTypeRaw = pkg.packageType;
  if (typeof packageTypeRaw === 'string') {
    return packageTypeRaw.toLowerCase();
  }
  return String(packageTypeRaw ?? '').toLowerCase();
}

export function pickMonthlyAndYearlyPackages<T extends PackageLike>(
  offerings: T[]
): { monthly: T | null; yearly: T | null } {
  const monthlyByType = offerings.find((pkg) => getPackageTypeKey(pkg).includes('month')) ?? null;
  const yearlyByType =
    offerings.find((pkg) => {
      const key = getPackageTypeKey(pkg);
      return key.includes('annual') || key.includes('year');
    }) ?? null;

  const monthly =
    monthlyByType ??
    offerings.find((pkg) => (pkg.identifier ?? '').toLowerCase().includes('month')) ??
    null;

  const yearly =
    yearlyByType ??
    offerings.find((pkg) => {
      const identifier = (pkg.identifier ?? '').toLowerCase();
      return identifier.includes('year') || identifier.includes('annual');
    }) ??
    null;

  return { monthly, yearly };
}

export function hasActiveEntitlement(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const maybeObj = value as {
    customerInfo?: { entitlements?: { active?: Record<string, unknown> } };
    entitlements?: { active?: Record<string, unknown> };
  };
  const active = maybeObj.customerInfo?.entitlements?.active ?? maybeObj.entitlements?.active;
  if (!active || typeof active !== 'object') return false;
  return Object.keys(active).length > 0;
}

export function isPurchaseCanceledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { userCancelled?: boolean; code?: unknown };
  if (maybeError.userCancelled === true) return true;
  const code = String(maybeError.code ?? '').toLowerCase();
  return code.includes('user_cancelled') || code.includes('purchasecancellederror');
}

export function computeYearlyValueSignal(
  monthlyPrice: number | null | undefined,
  yearlyPrice: number | null | undefined
): { monthlyEquivalent?: number; savePercent?: number } {
  if (
    typeof yearlyPrice !== 'number' ||
    !Number.isFinite(yearlyPrice) ||
    yearlyPrice <= 0
  ) {
    return {};
  }

  const monthlyEquivalent = yearlyPrice / 12;
  if (!Number.isFinite(monthlyEquivalent) || monthlyEquivalent <= 0) {
    return {};
  }

  let savePercent: number | undefined;
  if (
    typeof monthlyPrice === 'number' &&
    Number.isFinite(monthlyPrice) &&
    monthlyPrice > 0
  ) {
    const savings = ((monthlyPrice - monthlyEquivalent) / monthlyPrice) * 100;
    if (Number.isFinite(savings) && savings > 0) {
      savePercent = Math.round(savings);
    }
  }

  return { monthlyEquivalent, savePercent };
}
