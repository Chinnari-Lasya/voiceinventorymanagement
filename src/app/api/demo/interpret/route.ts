import { z } from "zod";
import { insertVoiceEvent } from "@/server/db/repositories/voiceEvents";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID, getCatalog } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";
import { interpret } from "@/server/voice/interpret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  text: z.string().min(1).max(300),
  via: z.enum(["mic", "typed"]).default("typed"),
});

/** Read-only w.r.t. stock: proposes an interpretation and logs the attempt. Never changes inventory. */
export const POST = withAuth(async (req, { user }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", "Please provide the command text.");
  const db = demoDb();
  const t0 = performance.now();
  const result = interpret(parsed.data.text, getCatalog(db));
  const eventId = insertVoiceEvent(db, {
    shopId: SHOP_ID,
    userId: user.id,
    transcript: parsed.data.text,
    engine: parsed.data.via === "mic" ? "web_speech" : "typed",
    status: result.ok ? "pending_confirm" : "needs_clarification",
    tier: result.ok ? "T1" : "T3",
    plan: result.ok ? result.interpretation : null,
    error: result.ok ? null : result.message,
    latencyMs: Math.round(performance.now() - t0),
  });
  return ok({ ...result, eventId });
});
