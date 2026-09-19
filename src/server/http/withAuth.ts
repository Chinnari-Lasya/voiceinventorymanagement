import { tokenFromCookieHeader, userFromToken } from "@/server/auth/session";
import { demoDb } from "@/server/demo/db";
import type { MeView } from "@/shared/demo";
import { fail } from "./envelope";
import { withRequestId, type RequestContext } from "./withRequestId";

export type AuthContext = RequestContext & { user: MeView };

/** withRequestId + a signed-in user (401 envelope otherwise). */
export function withAuth<C = unknown>(handler: (req: Request, ctx: AuthContext, route: C) => Promise<Response> | Response) {
  return withRequestId<C>(async (req, ctx, route) => {
    const user = userFromToken(demoDb(), tokenFromCookieHeader(req.headers.get("cookie")));
    if (!user) return fail(401, "unauthenticated", "Please sign in to continue.");
    return handler(req, { ...ctx, user }, route);
  });
}
