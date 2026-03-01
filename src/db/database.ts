import * as SQLite from 'expo-sqlite';

const DB_NAME = 'starterbuddy.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await runMigrations(db);
  }
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const versionRow = await database.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM schema_version'
  );
  const currentVersion = versionRow?.version ?? 0;

  const migrations: Array<{
    version: number;
    sql?: string;
    run?: (db: SQLite.SQLiteDatabase) => Promise<void>;
  }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS starters (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          photo_uri TEXT,
          flour_type TEXT NOT NULL DEFAULT 'All-purpose',
          hydration_target INTEGER NOT NULL DEFAULT 100,
          storage_mode TEXT NOT NULL DEFAULT 'counter' CHECK(storage_mode IN ('counter', 'fridge')),
          preferred_ratio_a INTEGER NOT NULL DEFAULT 1,
          preferred_ratio_b INTEGER NOT NULL DEFAULT 3,
          preferred_ratio_c INTEGER NOT NULL DEFAULT 3,
          default_feed_interval_hours INTEGER NOT NULL DEFAULT 12,
          baseline_peak_hours REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY NOT NULL,
          starter_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('FEED', 'BAKE', 'DISCARD', 'NOTE')),
          timestamp TEXT NOT NULL,
          starter_g REAL,
          flour_g REAL,
          water_g REAL,
          ratio_string TEXT,
          ambient_temp REAL,
          peak_confirmed_hours REAL,
          notes TEXT,
          FOREIGN KEY (starter_id) REFERENCES starters(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_events_starter_timestamp
          ON events(starter_id, timestamp DESC);
      `,
    },
    {
      version: 2,
      run: async (db) => {
        const columns = await db.getAllAsync<{ name: string }>(
          `PRAGMA table_info(starters)`
        );
        const hasColor = columns.some((column) => column.name === 'color');
        if (!hasColor) {
          await db.execAsync(`ALTER TABLE starters ADD COLUMN color TEXT;`);
        }
      },
    },
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      if (migration.run) {
        await migration.run(database);
      } else if (migration.sql) {
        await database.execAsync(migration.sql);
      }
      await database.runAsync(
        'INSERT INTO schema_version (version) VALUES (?)',
        [migration.version]
      );
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
