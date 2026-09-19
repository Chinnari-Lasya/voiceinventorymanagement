import { clearedCookie } from "@/server/auth/session";
import { ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRequestId(() => {
  const res = ok({ loggedOut: true });
  res.headers.append("set-cookie", clearedCookie());
  return res;
});
