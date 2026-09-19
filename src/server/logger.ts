// Tiny structured JSON logger (ARCHITECTURE §9). No dependency, no PII beyond what callers pass.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

const SENSITIVE_KEY = /api[-_]?key|pin|password|secret|authorization|cookie|token/i;

/** Redact values whose key looks sensitive; keeps keys/API keys/PINs out of logs even if passed by mistake. */
function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

function serialiseError(err: unknown): Fields {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
}

/** Convenience for `log.error("...", { err: errorFields(e) })`. */
export function errorFields(err: unknown): Fields {
  return serialiseError(err);
}

function create(base: Fields): Logger {
  const emit = (level: Level, msg: string, fields?: Fields) => {
    // Keep test output clean; production/dev logs go to stdout/stderr as JSON lines.
    if (process.env.NODE_ENV === "test") return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...redact({ ...base, ...fields }) });
    (level === "error" || level === "warn" ? console.error : console.log)(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) => create({ ...base, ...fields }),
  };
}

export const logger: Logger = create({});
