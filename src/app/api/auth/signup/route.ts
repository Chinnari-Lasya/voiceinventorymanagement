import { z } from "zod";
import { hashPassword, sessionCookie } from "@/server/auth/session";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  storeName: z.string().trim().min(2, "Enter your store name.").max(60),
  ownerName: z.string().trim().min(2, "Enter the owner's name.").max(60),
  contact: z.string().trim().min(5, "Enter a phone number or email.").max(80),
  password: z.string().min(4, "Use at least 4 characters.").max(100),
  remember: z.boolean().optional(),
});

/** Prototype signup: creates an owner account attached to the demo shop and names the shop. */
export const POST = withRequestId(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", parsed.error.issues[0]?.message ?? "Please check the form.");
  const { storeName, ownerName, contact, password, remember } = parsed.data;

  const db = demoDb();
  const username = contact.toLowerCase();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return fail(409, "exists", "An account with that phone/email already exists. Try signing in.");
  }
  const id = `u-${crypto.randomUUID().slice(0, 8)}`;
  db.transaction(() => {
    db.prepare("INSERT INTO users (id, shop_id, username, pin_hash, display_name) VALUES (?,?,?,?,?)").run(
      id,
      SHOP_ID,
      username,
      hashPassword(password),
      ownerName,
    );
    db.prepare("UPDATE shops SET name = ? WHERE id = ?").run(storeName, SHOP_ID);
  })();

  const res = ok({ id });
  res.headers.append("set-cookie", sessionCookie(id, Boolean(remember)));
  return res;
});
