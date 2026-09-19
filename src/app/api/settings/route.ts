import { z } from "zod";
import { loadUser } from "@/server/auth/session";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  storeName: z.string().trim().min(2).max(60).optional(),
  ownerName: z.string().trim().min(2).max(60).optional(),
  language: z.enum(["en", "hi", "te"]).optional(),
  voiceLang: z.enum(["en-IN", "hi-IN", "te-IN"]).optional(),
  notifications: z.object({ lowStock: z.boolean(), dailySummary: z.boolean(), voiceTips: z.boolean() }).partial().optional(),
});

export const GET = withAuth((_req, { user }) => ok(user));

export const PATCH = withAuth(async (req, { user }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", parsed.error.issues[0]?.message ?? "Please check the form.");
  const p = parsed.data;
  const db = demoDb();

  db.transaction(() => {
    if (p.storeName) db.prepare("UPDATE shops SET name = ? WHERE id = ?").run(p.storeName, SHOP_ID);
    if (p.ownerName) db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(p.ownerName, user.id);
    if (p.language || p.voiceLang || p.notifications) {
      const prefs = {
        ...user.preferences,
        ...(p.language ? { language: p.language } : {}),
        ...(p.voiceLang ? { voiceLang: p.voiceLang } : {}),
        notifications: { ...user.preferences.notifications, ...p.notifications },
      };
      db.prepare("UPDATE users SET preferences = ? WHERE id = ?").run(JSON.stringify(prefs), user.id);
    }
  })();

  return ok(loadUser(db, user.id));
});
