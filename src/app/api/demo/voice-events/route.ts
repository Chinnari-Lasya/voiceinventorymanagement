import { listVoiceEvents } from "@/server/db/repositories/voiceEvents";
import { demoDb } from "@/server/demo/db";
import { SHOP_ID } from "@/server/domain/inventory";
import { ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(() => ok(listVoiceEvents(demoDb(), SHOP_ID, 10)));
