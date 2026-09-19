import { getConfig } from "@/server/config";
import { getDb } from "@/server/db/connection";
import { errorFields } from "@/server/logger";
import { fail, ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + readiness. Reveals only whether things are configured, never any secret value. */
export const GET = withRequestId(async (_req, { log }) => {
  const config = getConfig();

  let schemaVersion: string | null;
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    const row = db.prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get() as
      | { version: string }
      | undefined;
    schemaVersion = row?.version ?? null;
  } catch (err) {
    log.error("health check: database unavailable", { err: errorFields(err) });
    return fail(503, "db_unavailable", "The database is not available.");
  }

  return ok({
    status: "ok" as const,
    db: "ok" as const,
    schemaVersion,
    llm: config.anthropicApiKey ? ("configured" as const) : ("missing" as const),
    version: pkg.version,
  });
});
