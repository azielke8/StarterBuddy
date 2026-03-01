import { File, Paths } from 'expo-file-system';
import { trackFunnel } from './upgradeFunnel';

export type ProTriggerKey =
  | 'analytics_opened_locked'
  | 'multi_culture_locked_action';

type TriggerStore = {
  lastGlobalShownAt: number | null;
  perTrigger: Partial<Record<ProTriggerKey, number>>;
};

const PRO_TRIGGER_FILE = new File(Paths.document, 'pro-triggers.json');
const GLOBAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PER_TRIGGER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

let sessionTriggerShown = false;
type TriggerSuppressionReason =
  | 'globalCooldown'
  | 'triggerCooldown'
  | 'sessionThrottle'
  | 'isPro'
  | 'unknown';

async function readStore(): Promise<TriggerStore> {
  try {
    const raw = (await PRO_TRIGGER_FILE.text()).trim();
    if (!raw) {
      return { lastGlobalShownAt: null, perTrigger: {} };
    }
    const parsed = JSON.parse(raw) as TriggerStore;
    return {
      lastGlobalShownAt:
        typeof parsed.lastGlobalShownAt === 'number' ? parsed.lastGlobalShownAt : null,
      perTrigger: parsed.perTrigger ?? {},
    };
  } catch {
    return { lastGlobalShownAt: null, perTrigger: {} };
  }
}

async function writeStore(store: TriggerStore): Promise<void> {
  try {
    await PRO_TRIGGER_FILE.create({ overwrite: true });
    await PRO_TRIGGER_FILE.write(JSON.stringify(store));
  } catch {
    // Best effort persistence.
  }
}

export async function getProTriggerCooldownMs(key: ProTriggerKey): Promise<number> {
  if (sessionTriggerShown) {
    return Number.MAX_SAFE_INTEGER;
  }
  const store = await readStore();
  const now = Date.now();
  const globalRemaining = store.lastGlobalShownAt
    ? Math.max(0, GLOBAL_COOLDOWN_MS - (now - store.lastGlobalShownAt))
    : 0;
  const keyLastShownAt = store.perTrigger[key] ?? null;
  const keyRemaining = keyLastShownAt
    ? Math.max(0, PER_TRIGGER_COOLDOWN_MS - (now - keyLastShownAt))
    : 0;
  return Math.max(globalRemaining, keyRemaining);
}

export async function shouldShowProTrigger(key: ProTriggerKey): Promise<boolean> {
  const reason = await getProTriggerBlockReason(key);
  return reason === null;
}

async function getProTriggerBlockReason(
  key: ProTriggerKey
): Promise<TriggerSuppressionReason | null> {
  if (sessionTriggerShown) {
    return 'sessionThrottle';
  }
  const store = await readStore();
  const now = Date.now();
  const globalRemaining = store.lastGlobalShownAt
    ? GLOBAL_COOLDOWN_MS - (now - store.lastGlobalShownAt)
    : 0;
  if (globalRemaining > 0) {
    return 'globalCooldown';
  }
  const keyLastShownAt = store.perTrigger[key] ?? null;
  const triggerRemaining = keyLastShownAt
    ? PER_TRIGGER_COOLDOWN_MS - (now - keyLastShownAt)
    : 0;
  if (triggerRemaining > 0) {
    return 'triggerCooldown';
  }
  return null;
}

export async function markProTriggerShown(key: ProTriggerKey): Promise<void> {
  const now = Date.now();
  sessionTriggerShown = true;
  const store = await readStore();
  const nextStore: TriggerStore = {
    lastGlobalShownAt: now,
    perTrigger: {
      ...store.perTrigger,
      [key]: now,
    },
  };
  await writeStore(nextStore);
}

export function openProPaywall(
  navigation: any,
  context: { trigger: ProTriggerKey; title?: string; message?: string; placement?: string }
): void {
  const placement = context.placement ?? 'trigger';
  const params = {
    trigger: context.trigger,
    title: context.title,
    message: context.message,
    placement,
  };
  const parent = navigation.getParent?.();
  if (parent?.navigate) {
    parent.navigate('ProPaywall' as never, params as never);
    return;
  }
  navigation.navigate?.('ProPaywall' as never, params as never);
}

export async function maybeShowProPaywall(
  navigation: any,
  isPro: boolean,
  key: ProTriggerKey,
  context: { title?: string; message?: string; placement?: string } = {},
  options?: { force?: boolean }
): Promise<boolean> {
  const placement = context.placement ?? 'trigger';
  await trackFunnel('trigger_eligible', { trigger: key, placement });
  if (isPro) {
    await trackFunnel('trigger_suppressed', {
      trigger: key,
      placement,
      reason: 'isPro',
    });
    return false;
  }
  const forceShow = __DEV__ && options?.force === true;
  if (!forceShow) {
    const blockReason = await getProTriggerBlockReason(key);
    if (blockReason) {
      await trackFunnel('trigger_suppressed', {
        trigger: key,
        placement,
        reason: blockReason,
      });
      return false;
    }
    await markProTriggerShown(key);
  }
  await trackFunnel('trigger_shown', { trigger: key, placement });
  if (__DEV__) {
    console.log('PRO_TRIGGER_SHOWN', key, new Date().toISOString());
  }
  openProPaywall(navigation, {
    trigger: key,
    title: context.title,
    message: context.message,
    placement,
  });
  return true;
}
