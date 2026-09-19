import { z } from "zod";
import { sessionCookie, verifyPassword } from "@/server/auth/session";
import { demoDb } from "@/server/demo/db";
import { fail, ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  contact: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(100),
  remember: z.boolean().optional(),
});

export const POST = withRequestId(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "Enter your phone/email and password.");
  const { contact, password, remember } = parsed.data;

  const row = demoDb().prepare("SELECT id, pin_hash FROM users WHERE username = ?").get(contact.toLowerCase()) as
    | { id: string; pin_hash: string }
    | undefined;
  // Same message for unknown user and wrong password.
  if (!row || !verifyPassword(password, row.pin_hash)) return fail(401, "invalid_credentials", "Wrong phone/email or password.");

  const res = ok({ id: row.id });
  res.headers.append("set-cookie", sessionCookie(row.id, Boolean(remember)));
  return res;
});
