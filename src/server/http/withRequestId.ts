import { errorFields, logger, type Logger } from "@/server/logger";
import { fail } from "./envelope";

export interface RequestContext {
  requestId: string;
  log: Logger;
}

type Handler<C> = (req: Request, ctx: RequestContext, route: C) => Promise<Response> | Response;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Wraps a route handler: assigns/propagates `x-request-id`, provides a request-scoped logger,
 * and converts any unexpected error into a generic 500 envelope (stack goes to logs only).
 */
export function withRequestId<C = unknown>(handler: Handler<C>) {
  return async (req: Request, route?: C): Promise<Response> => {
    const incoming = req.headers.get("x-request-id");
    const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    const log = logger.child({ requestId });

    let res: Response;
    try {
      res = await handler(req, { requestId, log }, route as C);
    } catch (err) {
      log.error("unhandled error in route handler", { path: new URL(req.url).pathname, err: errorFields(err) });
      res = fail(500, "internal_error", "Something went wrong. Please try again.", { requestId });
    }
    res.headers.set("x-request-id", requestId);
    return res;
  };
}
