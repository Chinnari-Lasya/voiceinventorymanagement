import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "@/server/config";
import { closeDb } from "@/server/db/connection";
import { fail, ok } from "@/server/http/envelope";
import { withRequestId } from "@/server/http/withRequestId";

const ENV_KEYS = ["DATABASE_PATH", "ANTHROPIC_API_KEY", "SESSION_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.ANTHROPIC_API_KEY;
  resetConfigForTests();
});

afterEach(() => {
  closeDb();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetConfigForTests();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function callHealth(headers?: Record<string, string>) {
  const { GET } = await import("@/app/api/health/route");
  return GET(new Request("http://localhost/api/health", { headers }));
}

describe("GET /api/health", () => {
  it("reports db ok, schema version, and llm missing without a key", async () => {
    const res = await callHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: { status: "ok", db: "ok", schemaVersion: "002_profile", llm: "missing", version: expect.any(String) },
    });
  });

  it("reports llm configured when a key is set, and never leaks the key", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-not-a-real-key";
    resetConfigForTests();
    const res = await callHealth();
    const text = await res.text();
    expect(JSON.parse(text).data.llm).toBe("configured");
    expect(text).not.toContain("sk-test-not-a-real-key");
  });

  it("returns a request id header and propagates a valid incoming one", async () => {
    const generated = await callHealth();
    expect(generated.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    const propagated = await callHealth({ "x-request-id": "req-12345678" });
    expect(propagated.headers.get("x-request-id")).toBe("req-12345678");
  });

  it("returns a 503 envelope when the database is unavailable", async () => {
    vi.doMock("@/server/db/connection", () => ({
      getDb: () => {
        throw new Error("disk on fire");
      },
    }));
    const res = await callHealth();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { code: "db_unavailable", message: "The database is not available." } });
    expect(JSON.stringify(body)).not.toContain("disk on fire");
    vi.doUnmock("@/server/db/connection");
  });
});

describe("response envelope and withRequestId (AC-099)", () => {
  it("builds success and failure envelopes", async () => {
    expect(await ok({ a: 1 }).json()).toEqual({ ok: true, data: { a: 1 } });
    const f = fail(422, "bad", "Nope", { field: "x" });
    expect(f.status).toBe(422);
    expect(await f.json()).toEqual({ ok: false, error: { code: "bad", message: "Nope", details: { field: "x" } } });
  });

  it("turns unexpected errors into a generic 500 with the request id and no internals", async () => {
    const handler = withRequestId(() => {
      throw new Error("secret internal detail");
    });
    const res = await handler(new Request("http://localhost/x"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.details.requestId).toBe(res.headers.get("x-request-id"));
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });
});
