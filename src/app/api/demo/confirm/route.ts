import { z } from "zod";
import { eventExists, setVoiceEventStatus } from "@/server/db/repositories/voiceEvents";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID, applyChange } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  productId: z.string().min(1),
  op: z.enum(["add", "remove"]),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().min(1).max(20),
  via: z.enum(["mic", "typed"]),
  eventId: z.string().optional(),
});

/** The only voice/typed write path: re-validated server-side, applied atomically with a ledger row. */
export const POST = withAuth(async (req, { user }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "That confirmation wasn't valid.");
  const db = demoDb();
  const { eventId, ...change } = parsed.data;
  const validEvent = eventId && eventExists(db, SHOP_ID, eventId) ? eventId : undefined;
  const result = applyChange(db, { ...change, userId: user.id, eventId: validEvent });
  if (!result.ok) return fail(422, result.code, result.message);
  if (validEvent) setVoiceEventStatus(db, SHOP_ID, validEvent, "applied");
  return ok(result);
});
