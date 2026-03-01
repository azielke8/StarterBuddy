import { normalizeHexColor } from './colors';

export function getStarterColor(
  starter: { color?: string | null },
  fallbackSeed?: string
): string | null {
  void fallbackSeed;
  return normalizeHexColor(starter.color ?? null);
}
