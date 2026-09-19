import type { Database } from "better-sqlite3";
import { DEMO_PASSWORD, DEMO_USERNAME, hashPassword } from "@/server/auth/session";
import { getDb } from "@/server/db/connection";
import { SHOP_ID, ensureDemoData } from "@/server/domain/inventory";

/** DB handle with the demo shop and the demo account guaranteed to exist. */
export function demoDb(): Database {
  const db = getDb();
  ensureDemoData(db);
  const has = db.prepare("SELECT 1 FROM users WHERE username = ?").get(DEMO_USERNAME);
  if (!has) {
    db.prepare("INSERT INTO users (id, shop_id, username, pin_hash, display_name) VALUES ('u-demo', ?, ?, ?, 'Lakshmi Devi')").run(
      SHOP_ID,
      DEMO_USERNAME,
      hashPassword(DEMO_PASSWORD),
    );
  }
  return db;
}
