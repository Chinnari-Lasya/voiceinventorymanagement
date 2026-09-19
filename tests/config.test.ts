import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@/server/config";

const SECRET = "x".repeat(32);

describe("loadConfig (AC-090)", () => {
  it("applies safe defaults in development", () => {
    const c = loadConfig({});
    expect(c.nodeEnv).toBe("development");
    expect(c.databasePath).toBe("./data/stockbol.db");
    expect(c.llmModel).toBe("claude-haiku-4-5-20251001");
    expect(c.demoMode).toBe(false);
    expect(c.anthropicApiKey).toBeUndefined();
    expect(c.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("treats empty strings from .env as unset (missing API key is allowed)", () => {
    const c = loadConfig({ ANTHROPIC_API_KEY: "", SESSION_SECRET: "", DATABASE_PATH: "", LLM_MODEL: "", DEMO_MODE: "" });
    expect(c.anthropicApiKey).toBeUndefined();
    expect(c.databasePath).toBe("./data/stockbol.db");
    expect(c.demoMode).toBe(false);
  });

  it("reads provided values", () => {
    const c = loadConfig({
      NODE_ENV: "production",
      SESSION_SECRET: SECRET,
      ANTHROPIC_API_KEY: "test-key",
      DATABASE_PATH: "/var/data/s.db",
      LLM_MODEL: "claude-sonnet-5",
      DEMO_MODE: "1",
    });
    expect(c).toMatchObject({
      nodeEnv: "production",
      sessionSecret: SECRET,
      anthropicApiKey: "test-key",
      databasePath: "/var/data/s.db",
      llmModel: "claude-sonnet-5",
      demoMode: true,
    });
  });

  it("requires SESSION_SECRET in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
  });

  it("rejects a too-short SESSION_SECRET in any environment, with a readable message", () => {
    expect(() => loadConfig({ SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET: must be at least 32 characters/);
  });

  it("rejects invalid DEMO_MODE and NODE_ENV", () => {
    expect(() => loadConfig({ DEMO_MODE: "yes" })).toThrow(/DEMO_MODE/);
    expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("never echoes secret values in error messages", () => {
    try {
      loadConfig({ SESSION_SECRET: "super-secret" });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain("super-secret");
    }
  });
});
