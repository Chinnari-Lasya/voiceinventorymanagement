import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as Db } from "better-sqlite3";
import { getConfig } from "@/server/config";
import { logger } from "@/server/logger";
import { runMigrations } from "./migrate";

/**
 * Opens a SQLite database with the project's standard pragmas and applies pending migrations.
 * `:memory:` is supported (tests). WAL is requested for file databases (in-memory DBs report "memory").
 */
export function openDatabase(dbPath: string): Db {
  const inMemory = dbPath === ":memory:";
  if (!inMemory) fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  const result = runMigrations(db);
  if (result.applied.length > 0) {
    logger.info("database migrated", { path: inMemory ? ":memory:" : dbPath, applied: result.applied });
  }
  return db;
}

// One connection per process. Stored on globalThis so Next.js dev HMR doesn't leak connections.
const globalForDb = globalThis as unknown as { __stockbolDb?: Db };

export function getDb(): Db {
  globalForDb.__stockbolDb ??= openDatabase(getConfig().databasePath);
  return globalForDb.__stockbolDb;
}

export function closeDb(): void {
  globalForDb.__stockbolDb?.close();
  globalForDb.__stockbolDb = undefined;
}
