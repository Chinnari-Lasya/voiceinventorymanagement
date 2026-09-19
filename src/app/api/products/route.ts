import { z } from "zod";
import { demoDb } from "@/server/demo/db";
import { PRODUCT_UNITS, createProduct } from "@/server/domain/products";
import { fail, ok } from "@/server/http/envelope";
import { withAuth } from "@/server/http/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(60),
  category: z.string().trim().max(40).default(""),
  unit: z.enum(PRODUCT_UNITS),
  initialStock: z.number().min(0).max(1_000_000),
  threshold: z.number().min(0).max(1_000_000).nullable(),
});

export const POST = withAuth(async (req, { user }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request", parsed.error.issues[0]?.message ?? "Please check the form.");
  const result = createProduct(demoDb(), { ...parsed.data, userId: user.id });
  return result.ok ? ok({ id: result.id }, { status: 201 }) : fail(422, result.code, result.message);
});
