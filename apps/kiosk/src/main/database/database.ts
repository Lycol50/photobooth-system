import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { databaseSchema } from './schema.js';

const MIGRATION_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

export type BoothDatabase = {
  readonly raw: BetterSqlite3.Database;
  readonly orm: BetterSQLite3Database<typeof databaseSchema>;
  close(): void;
};

export function openBoothDatabase(
  databasePath: string,
  migrationsDirectory: string,
): BoothDatabase {
  const raw = new BetterSqlite3(databasePath);
  try {
    raw.pragma('journal_mode = WAL');
    raw.pragma('synchronous = FULL');
    raw.pragma('foreign_keys = ON');
    raw.pragma('busy_timeout = 5000');
    raw.pragma('trusted_schema = OFF');
    raw.exec(
      'CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
    );
    applyMigrations(raw, migrationsDirectory);
    return {
      raw,
      orm: drizzle(raw, { schema: databaseSchema }),
      close: () => raw.close(),
    };
  } catch (error) {
    raw.close();
    throw error;
  }
}

function applyMigrations(database: BetterSqlite3.Database, directory: string): void {
  const files = readdirSync(directory)
    .filter((name) => MIGRATION_NAME.test(basename(name)))
    .sort((left, right) => left.localeCompare(right));
  const hasMigration = database.prepare('SELECT 1 FROM _local_migrations WHERE name = ?').pluck();
  const recordMigration = database.prepare(
    'INSERT INTO _local_migrations (name, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    if (hasMigration.get(file) === 1) continue;
    const sql = readFileSync(join(directory, file), 'utf8');
    database.transaction(() => {
      database.exec(sql);
      recordMigration.run(file, Date.now());
    })();
  }
}
