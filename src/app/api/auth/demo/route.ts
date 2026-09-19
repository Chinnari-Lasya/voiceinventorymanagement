import { DEMO_USERNAME, sessionCookie } from "@/server/auth/session";
import { demoDb } from "@/server/demo/db";
import { ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-click demo login (the demo account is created on first use). */
export const POST = withRequestId(() => {
  const row = demoDb().prepare("SELECT id FROM users WHERE username = ?").get(DEMO_USERNAME) as { id: string };
  const res = ok({ id: row.id });
  res.headers.append("set-cookie", sessionCookie(row.id, false));
  return res;
});
