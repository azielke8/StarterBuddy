import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { Starter, StorageMode } from '../models/types';

export interface CreateStarterInput {
  name: string;
  photo_uri?: string | null;
  flour_type?: string;
  hydration_target?: number;
  storage_mode?: StorageMode;
  preferred_ratio_a?: number;
  preferred_ratio_b?: number;
  preferred_ratio_c?: number;
  default_feed_interval_hours?: number;
}

export interface UpdateStarterInput {
  name?: string;
  photo_uri?: string | null;
  flour_type?: string;
  hydration_target?: number;
  storage_mode?: StorageMode;
  preferred_ratio_a?: number;
  preferred_ratio_b?: number;
  preferred_ratio_c?: number;
  default_feed_interval_hours?: number;
  baseline_peak_hours?: number | null;
}

export async function createStarter(input: CreateStarterInput): Promise<Starter> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();

  const starter: Starter = {
    id,
    name: input.name,
    photo_uri: input.photo_uri ?? null,
    flour_type: input.flour_type ?? 'All-purpose',
    hydration_target: input.hydration_target ?? 100,
    storage_mode: input.storage_mode ?? 'counter',
    preferred_ratio_a: input.preferred_ratio_a ?? 1,
    preferred_ratio_b: input.preferred_ratio_b ?? 3,
    preferred_ratio_c: input.preferred_ratio_c ?? 3,
    default_feed_interval_hours: input.default_feed_interval_hours ?? 12,
    baseline_peak_hours: null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO starters (id, name, photo_uri, flour_type, hydration_target, storage_mode,
      preferred_ratio_a, preferred_ratio_b, preferred_ratio_c,
      default_feed_interval_hours, baseline_peak_hours, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      starter.id, starter.name, starter.photo_uri, starter.flour_type,
      starter.hydration_target, starter.storage_mode,
      starter.preferred_ratio_a, starter.preferred_ratio_b, starter.preferred_ratio_c,
      starter.default_feed_interval_hours, starter.baseline_peak_hours,
      starter.created_at, starter.updated_at,
    ]
  );

  return starter;
}

export async function getStarter(id: string): Promise<Starter | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Starter>('SELECT * FROM starters WHERE id = ?', [id]);
}

export async function getAllStarters(): Promise<Starter[]> {
  const db = await getDatabase();
  return db.getAllAsync<Starter>('SELECT * FROM starters ORDER BY created_at ASC');
}

export async function getStarterCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM starters');
  return row?.count ?? 0;
}

export async function updateStarter(id: string, input: UpdateStarterInput): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  values.push(id);
  await db.runAsync(
    `UPDATE starters SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteStarter(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM events WHERE starter_id = ?', [id]);
  await db.runAsync('DELETE FROM starters WHERE id = ?', [id]);
}
