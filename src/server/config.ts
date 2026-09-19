import { z } from "zod";

// A fixed value is acceptable ONLY outside production; production must supply its own secret.
const DEV_SESSION_SECRET = "dev-only-insecure-session-secret-change-me";

/** Treat empty strings (e.g. `ANTHROPIC_API_KEY=` in .env) as "not set". */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_PATH: z.preprocess(emptyToUndefined, z.string().min(1).default("./data/stockbol.db")),
  SESSION_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, "must be at least 32 characters").optional(),
  ),
  // Optional: a missing key only means "Basic mode" (no LLM), never a boot failure.
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  LLM_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default("claude-haiku-4-5-20251001")),
  DEMO_MODE: z.preprocess(emptyToUndefined, z.enum(["0", "1"]).default("0")),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  databasePath: string;
  sessionSecret: string;
  anthropicApiKey: string | undefined;
  llmModel: string;
  demoMode: boolean;
}

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}\nSee .env.example.`);
    this.name = "ConfigError";
  }
}

/** Pure parser (testable): validates the env and applies safe defaults. Throws ConfigError with readable text. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`));
  }
  const e = parsed.data;

  if (e.NODE_ENV === "production" && !e.SESSION_SECRET) {
    throw new ConfigError(["SESSION_SECRET: required in production (>= 32 characters)"]);
  }

  return {
    nodeEnv: e.NODE_ENV,
    databasePath: e.DATABASE_PATH,
    sessionSecret: e.SESSION_SECRET ?? DEV_SESSION_SECRET,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    llmModel: e.LLM_MODEL,
    demoMode: e.DEMO_MODE === "1",
  };
}

let cached: AppConfig | undefined;

/** Process-wide config, validated on first use (fail fast with a readable message). */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Test helper: forget the cached config so the next getConfig() re-reads process.env. */
export function resetConfigForTests(): void {
  cached = undefined;
}
