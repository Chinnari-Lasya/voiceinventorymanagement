import { z } from "zod";
import { setVoiceEventStatus } from "@/server/db/repositories/voiceEvents";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ eventId: z.string().min(1) });

/** Marks a pending interpretation as cancelled in the audit log. Stock is untouched. */
export const POST = withAuth(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "Missing event.");
  setVoiceEventStatus(demoDb(), SHOP_ID, parsed.data.eventId, "cancelled");
  return ok({ cancelled: true });
});
