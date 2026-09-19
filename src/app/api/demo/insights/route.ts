import { demoDb } from "@/server/demo/db";
import { getInsights } from "@/server/domain/insights";
import { ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(() => ok(getInsights(demoDb())));
