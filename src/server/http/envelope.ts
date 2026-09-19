// Response envelope (ARCHITECTURE §8): { ok:true, data } | { ok:false, error:{ code, message, details? } }.

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies ApiResponse<T>, init);
}

export function fail(status: number, code: string, message: string, details?: unknown): Response {
  const error: ApiError = details === undefined ? { code, message } : { code, message, details };
  return Response.json({ ok: false, error } satisfies ApiResponse<never>, { status });
}
