import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";

export interface MigrationResult {
  applied: string[];
  current: string | null;
}

/** Resolved from the project root (the app is always started from the repo root: `npm run dev|start`). */
export const DEFAULT_MIGRATIONS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "src/server/db/migrations");

const FILE_PATTERN = /^(\d{3,})_[a-z0-9_]+\.sql$/;

/**
 * Applies pending `NNN_name.sql` files in order. Each migration runs in its own transaction together with its
 * `schema_migrations` row, so a failing migration leaves no partial schema. Safe to call repeatedly (idempotent).
 * No down-migrations: for the hackathon we reseed instead.
 */
export function runMigrations(db: Database, dir: string = DEFAULT_MIGRATIONS_DIR): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const f of files) {
    if (!FILE_PATTERN.test(f)) throw new Error(`Invalid migration filename: ${f} (expected NNN_name.sql)`);
  }

  const done = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: string }[]).map((r) => r.version),
  );

  const applied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (done.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
    })();
    applied.push(version);
  }

  const row = db.prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get() as
    | { version: string }
    | undefined;
  return { applied, current: row?.version ?? null };
}
