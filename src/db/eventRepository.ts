import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { StarterEvent, EventType } from '../models/types';
import { parseLevainStartReadyBy } from '../utils/levainPlanner';

export interface CreateEventInput {
  starter_id: string;
  type: EventType;
  timestamp?: string;
  starter_g?: number | null;
  flour_g?: number | null;
  water_g?: number | null;
  ratio_string?: string | null;
  ambient_temp?: number | null;
  peak_confirmed_hours?: number | null;
  notes?: string | null;
}

export async function createEvent(input: CreateEventInput): Promise<StarterEvent> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const timestamp = input.timestamp ?? new Date().toISOString();

  const event: StarterEvent = {
    id,
    starter_id: input.starter_id,
    type: input.type,
    timestamp,
    starter_g: input.starter_g ?? null,
    flour_g: input.flour_g ?? null,
    water_g: input.water_g ?? null,
    ratio_string: input.ratio_string ?? null,
    ambient_temp: input.ambient_temp ?? null,
    peak_confirmed_hours: input.peak_confirmed_hours ?? null,
    notes: input.notes ?? null,
  };

  await db.runAsync(
    `INSERT INTO events (id, starter_id, type, timestamp, starter_g, flour_g, water_g,
      ratio_string, ambient_temp, peak_confirmed_hours, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id, event.starter_id, event.type, event.timestamp,
      event.starter_g, event.flour_g, event.water_g,
      event.ratio_string, event.ambient_temp, event.peak_confirmed_hours,
      event.notes,
    ]
  );

  return event;
}

export async function getEventsForStarter(
  starterId: string,
  limit?: number
): Promise<StarterEvent[]> {
  const db = await getDatabase();
  const query = limit
    ? 'SELECT * FROM events WHERE starter_id = ? ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM events WHERE starter_id = ? ORDER BY timestamp DESC';
  const params = limit ? [starterId, limit] : [starterId];
  return db.getAllAsync<StarterEvent>(query, params);
}

export async function getLastFeedEvent(starterId: string): Promise<StarterEvent | null> {
  const db = await getDatabase();
  return db.getFirstAsync<StarterEvent>(
    `SELECT * FROM events WHERE starter_id = ? AND type = 'FEED' ORDER BY timestamp DESC LIMIT 1`,
    [starterId]
  );
}

export async function getConfirmedPeaks(starterId: string, limit: number = 10): Promise<StarterEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<StarterEvent>(
    `SELECT * FROM events WHERE starter_id = ? AND type = 'FEED' AND peak_confirmed_hours IS NOT NULL
     ORDER BY timestamp DESC LIMIT ?`,
    [starterId, limit]
  );
}

export async function updateEventPeak(eventId: string, peakHours: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE events SET peak_confirmed_hours = ? WHERE id = ?',
    [peakHours, eventId]
  );
}

export async function getMostRecentLevainStartEvent(
  starterId: string
): Promise<{ timestamp: string; notes: string | null } | null> {
  const db = await getDatabase();
  return db.getFirstAsync<{ timestamp: string; notes: string | null }>(
    `SELECT timestamp, notes
     FROM events
     WHERE starter_id = ?
       AND type = 'NOTE'
       AND notes LIKE 'LEV_START|%'
     ORDER BY timestamp DESC
     LIMIT 1`,
    [starterId]
  );
}

export async function getActiveLevainSession(
  starterId: string
): Promise<{ starter_id: string; startAt: Date; readyBy: Date } | null> {
  const db = await getDatabase();
  const latestStart = await db.getFirstAsync<{ timestamp: string; notes: string | null }>(
    `SELECT timestamp, notes
     FROM events
     WHERE starter_id = ?
       AND type = 'NOTE'
       AND notes LIKE 'LEV_START|%'
     ORDER BY timestamp DESC
     LIMIT 1`,
    [starterId]
  );

  if (!latestStart) return null;
  const parsedStart = parseLevainStartReadyBy(latestStart.notes);
  if (!parsedStart) return null;

  const latestEnd = await db.getFirstAsync<{ timestamp: string; notes: string | null }>(
    `SELECT timestamp, notes
     FROM events
     WHERE starter_id = ?
       AND type = 'NOTE'
       AND notes LIKE 'LEV_END|%'
     ORDER BY timestamp DESC
     LIMIT 1`,
    [starterId]
  );

  if (!latestEnd) {
    return { starter_id: starterId, ...parsedStart };
  }

  const endLine = latestEnd.notes?.split('\n')[0] ?? '';
  const endParts = endLine.split('|');
  if (endParts.length >= 4 && endParts[0] === 'LEV_END' && endParts[2] === 'START') {
    const endedStartIso = endParts[3];
    if (endedStartIso === parsedStart.startAt.toISOString()) {
      return null;
    }
    return { starter_id: starterId, ...parsedStart };
  }

  const endTs = new Date(latestEnd.timestamp).getTime();
  const startTs = new Date(latestStart.timestamp).getTime();
  if (Number.isNaN(endTs) || Number.isNaN(startTs)) {
    return { starter_id: starterId, ...parsedStart };
  }

  return endTs < startTs ? { starter_id: starterId, ...parsedStart } : null;
}

export async function getAllEvents(): Promise<StarterEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<StarterEvent>('SELECT * FROM events ORDER BY timestamp DESC');
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
}
