import { z } from "zod";
import { demoDb } from "@/server/demo/db";
import { archiveProduct, updateProduct } from "@/server/domain/products";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Route = { params: Promise<{ id: string }> };

const patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  category: z.string().trim().max(40).optional(),
  threshold: z.number().min(0).max(1_000_000).nullable().optional(),
});

export const PATCH = withAuth<Route>(async (req, _ctx, route) => {
  const { id } = await route.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", parsed.error.issues[0]?.message ?? "Please check the form.");
  const result = updateProduct(demoDb(), id, parsed.data);
  return result.ok ? ok({ id }) : fail(result.code === "not_found" ? 404 : 422, result.code, result.message);
});

/** "Delete" archives the product: it disappears from the catalog and voice matching, history is kept. */
export const DELETE = withAuth<Route>(async (_req, _ctx, route) => {
  const { id } = await route.params;
  const result = archiveProduct(demoDb(), id);
  return result.ok ? ok({ id }) : fail(404, result.code, result.message);
});
