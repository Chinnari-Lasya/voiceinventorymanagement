import type { Database } from "better-sqlite3";
import type { VoiceEventView } from "@/shared/demo";

// Audit log of every voice/typed command (voice_events table). Never used to change stock.

export interface NewVoiceEvent {
  shopId: string;
  userId: string;
  transcript: string;
  engine: "web_speech" | "typed" | "server";
  status: "pending_confirm" | "needs_clarification";
  tier: "T1" | "T3";
  plan: unknown | null;
  error: string | null;
  latencyMs: number;
}

export function insertVoiceEvent(db: Database, e: NewVoiceEvent): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO voice_events (id, shop_id, user_id, transcript, stt_engine, interpreter, plan, tier, status, error, latency_ms)
     VALUES (?,?,?,?,?,'fallback',?,?,?,?,?)`,
  ).run(id, e.shopId, e.userId, e.transcript, e.engine, e.plan === null ? null : JSON.stringify(e.plan), e.tier, e.status, e.error, e.latencyMs);
  return id;
}

export function eventExists(db: Database, shopId: string, id: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM voice_events WHERE id = ? AND shop_id = ?").get(id, shopId));
}

export function setVoiceEventStatus(db: Database, shopId: string, id: string, status: "applied" | "cancelled"): void {
  db.prepare(
    "UPDATE voice_events SET status = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND shop_id = ?",
  ).run(status, id, shopId);
}

export function listVoiceEvents(db: Database, shopId: string, limit: number): VoiceEventView[] {
  const rows = db
    .prepare(
      `SELECT id, transcript, stt_engine, status, plan, error, created_at FROM voice_events
       WHERE shop_id = ? ORDER BY rowid DESC LIMIT ?`,
    )
    .all(shopId, limit) as {
    id: string;
    transcript: string;
    stt_engine: VoiceEventView["engine"];
    status: string;
    plan: string | null;
    error: string | null;
    created_at: string;
  }[];
  return rows.map((r) => {
    let summary: string | null = null;
    if (r.plan) {
      try {
        summary = (JSON.parse(r.plan) as { summary?: string }).summary ?? null;
      } catch {
        summary = null;
      }
    }
    return { id: r.id, transcript: r.transcript, engine: r.stt_engine, status: r.status, summary, error: r.error, createdAt: r.created_at };
  });
}
