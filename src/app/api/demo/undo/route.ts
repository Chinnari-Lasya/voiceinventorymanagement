import { demoDb } from "@/server/demo/db";
import { undoLast } from "@/server/domain/inventory";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth((_req, { user }) => {
  const result = undoLast(demoDb(), user.id);
  return result.ok ? ok(result) : fail(422, result.code, result.message);
});
