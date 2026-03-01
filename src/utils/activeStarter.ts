import { File, Paths } from 'expo-file-system';
import { getAllEvents, getAllStarters } from '../db';
import { Starter } from '../models/types';

const ACTIVE_STARTER_FILE = new File(Paths.document, 'active-starter-id.txt');

export async function getActiveStarterId(): Promise<string | null> {
  try {
    const raw = (await ACTIVE_STARTER_FILE.text()).trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export async function setActiveStarterId(starterId: string | null): Promise<void> {
  const value = starterId?.trim() ?? '';
  try {
    await ACTIVE_STARTER_FILE.create({ overwrite: true });
    await ACTIVE_STARTER_FILE.write(value);
  } catch {
    // Best effort persistence.
  }
}

export async function ensureActiveStarterId(
  isPro: boolean
): Promise<{ activeStarterId: string | null; starterCount: number; starters: Starter[] }> {
  const starters = await getAllStarters();
  const starterCount = starters.length;
  if (starterCount === 0) {
    return { activeStarterId: null, starterCount, starters: [] };
  }

  const validStarterIds = new Set(starters.map((starter) => starter.id));
  let activeStarterId = await getActiveStarterId();
  const isValidActiveStarter = !!activeStarterId && validStarterIds.has(activeStarterId);

  if (!isValidActiveStarter) {
    if (starterCount === 1) {
      activeStarterId = starters[0].id;
    } else if (isPro) {
      activeStarterId = starters[0].id;
    } else {
      const recentEvents = await getAllEvents();
      const recentStarterId = recentEvents.find((event) =>
        validStarterIds.has(event.starter_id)
      )?.starter_id;
      activeStarterId = recentStarterId ?? starters[0].id;
    }

    if (activeStarterId) {
      await setActiveStarterId(activeStarterId);
    }
  }

  return { activeStarterId: activeStarterId ?? null, starterCount, starters };
}
