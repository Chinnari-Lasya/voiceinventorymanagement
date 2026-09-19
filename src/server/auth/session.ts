import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Database } from "better-sqlite3";
import { getConfig } from "@/server/config";
import { DEFAULT_PREFERENCES, type MeView, type Preferences } from "@/shared/demo";

// PROTOTYPE authentication: salted scrypt password hashes + an HMAC-signed session cookie.
// Good enough for a demo; not production-grade (no CSRF tokens, lockout, email verification, or reset flow).

export const SESSION_COOKIE = "sb_session";
export const DEMO_USERNAME = "demo@stockbol.app";
export const DEMO_PASSWORD = "demo1234";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => createHmac("sha256", getConfig().sessionSecret).update(data).digest("base64url");

export function signToken(userId: string, ttlSeconds: number): string {
  const body = b64(JSON.stringify({ u: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): { u: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { u?: string; exp?: number };
    if (!p.u || !p.exp || p.exp < Date.now() / 1000) return null;
    return { u: p.u };
  } catch {
    return null;
  }
}

/** `remember` = persistent 30-day cookie; otherwise a browser-session cookie (8h server-side expiry). */
export function sessionCookie(userId: string, remember: boolean): string {
  const ttl = remember ? 30 * 86400 : 8 * 3600;
  const parts = [`${SESSION_COOKIE}=${signToken(userId, ttl)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (remember) parts.push(`Max-Age=${ttl}`);
  if (getConfig().nodeEnv === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function tokenFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=") || null;
  }
  return null;
}

export function parsePreferences(json: string | null): Preferences {
  if (!json) return DEFAULT_PREFERENCES;
  try {
    const p = JSON.parse(json) as Partial<Preferences>;
    return { ...DEFAULT_PREFERENCES, ...p, notifications: { ...DEFAULT_PREFERENCES.notifications, ...p.notifications } };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function loadUser(db: Database, id: string): MeView | null {
  const r = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.preferences, s.name AS shop_name
       FROM users u JOIN shops s ON s.id = u.shop_id WHERE u.id = ?`,
    )
    .get(id) as { id: string; username: string; display_name: string | null; preferences: string | null; shop_name: string } | undefined;
  if (!r) return null;
  return { id: r.id, username: r.username, displayName: r.display_name ?? r.username, shopName: r.shop_name, preferences: parsePreferences(r.preferences) };
}

export function userFromToken(db: Database, token: string | null): MeView | null {
  const v = token ? verifyToken(token) : null;
  return v ? loadUser(db, v.u) : null;
}
