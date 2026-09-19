import { demoDb } from "@/server/demo/db";
import { getTransactions } from "@/server/domain/inventory";
import { ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(() => ok(getTransactions(demoDb(), { limit: 200, includeOpening: true })));
