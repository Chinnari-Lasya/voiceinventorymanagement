import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db/connection";
import { runMigrations } from "@/server/db/migrate";

const open: { close(): unknown }[] = [];
const tmpDirs: string[] = [];

function memDb() {
  const db = openDatabase(":memory:");
  open.push(db);
  return db;
}

afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function seedBasics(db: ReturnType<typeof memDb>) {
  db.prepare("INSERT INTO shops (id, name) VALUES ('s1', 'Test Shop')").run();
  db.prepare("INSERT INTO users (id, shop_id, username, pin_hash) VALUES ('u1', 's1', 'owner', 'x')").run();
  db.prepare("INSERT INTO products (id, shop_id, name, base_unit, display_unit) VALUES ('p1', 's1', 'Rice', 'g', 'kg')").run();
}

function txn(db: ReturnType<typeof memDb>, id: string, extra: Record<string, unknown> = {}) {
  const row = { id, type: "purchase", delta_base: 1000, stock_after_base: 1000, source: "manual", ...extra };
  db.prepare(
    `INSERT INTO inventory_transactions (id, shop_id, product_id, type, delta_base, stock_after_base, source, reverses_txn_id)
     VALUES (@id, 's1', 'p1', @type, @delta_base, @stock_after_base, @source, @reverses_txn_id)`,
  ).run({ reverses_txn_id: null, ...row });
}

describe("migrations (AC-091)", () => {
  it("creates all core tables", () => {
    const db = memDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    for (const t of [
      "shops",
      "users",
      "products",
      "product_units",
      "product_aliases",
      "inventory_transactions",
      "voice_events",
      "schema_migrations",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("is idempotent: a second run applies nothing and records each migration once", () => {
    const db = memDb();
    const again = runMigrations(db);
    expect(again.applied).toEqual([]);
    expect(again.current).toBe("002_profile");
    expect(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()).toEqual({ n: 2 });
  });

  it("rejects a malformed migration filename", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stockbol-mig-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "bad-name.sql"), "SELECT 1;");
    const raw = new Database(":memory:");
    open.push(raw);
    expect(() => runMigrations(raw, dir)).toThrow(/Invalid migration filename/);
  });

  it("rolls back a failing migration completely", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stockbol-mig-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "001_bad.sql"), "CREATE TABLE t (id INTEGER); THIS IS NOT SQL;");
    const raw = new Database(":memory:");
    open.push(raw);
    expect(() => runMigrations(raw, dir)).toThrow();
    const tables = raw.prepare("SELECT name FROM sqlite_master WHERE name = 't'").all();
    expect(tables).toHaveLength(0);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()).toEqual({ n: 0 });
  });
});

describe("connection", () => {
  it("uses WAL mode with foreign keys on for file databases", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stockbol-db-"));
    tmpDirs.push(dir);
    const db = openDatabase(path.join(dir, "nested", "test.db"));
    open.push(db);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("persists across reopen", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stockbol-db-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "persist.db");
    const first = openDatabase(file);
    first.prepare("INSERT INTO shops (id, name) VALUES ('s1', 'Persisted')").run();
    first.close();
    const second = openDatabase(file);
    open.push(second);
    expect(second.prepare("SELECT name FROM shops WHERE id = 's1'").get()).toEqual({ name: "Persisted" });
  });
});

describe("schema constraints", () => {
  it("prevents negative stock at the database level (AC-094)", () => {
    const db = memDb();
    seedBasics(db);
    expect(() => db.prepare("UPDATE products SET stock_base = -1 WHERE id = 'p1'").run()).toThrow(/CHECK/);
    expect(() =>
      db.prepare("INSERT INTO products (id, shop_id, name, base_unit, display_unit, stock_base) VALUES ('p2','s1','Sugar','g','kg',-5)").run(),
    ).toThrow(/CHECK/);
  });

  it("only allows piece/g/ml as base units", () => {
    const db = memDb();
    seedBasics(db);
    expect(() =>
      db.prepare("INSERT INTO products (id, shop_id, name, base_unit, display_unit) VALUES ('p2','s1','Oil','litre','litre')").run(),
    ).toThrow(/CHECK/);
  });

  it("enforces unique product names per shop, case-insensitively", () => {
    const db = memDb();
    seedBasics(db);
    expect(() =>
      db.prepare("INSERT INTO products (id, shop_id, name, base_unit, display_unit) VALUES ('p2','s1','RICE','g','kg')").run(),
    ).toThrow(/UNIQUE/);
  });

  it("rejects a pack unit with a non-positive factor and duplicate pack units", () => {
    const db = memDb();
    seedBasics(db);
    const ins = db.prepare("INSERT INTO product_units (id, product_id, unit, factor_base, source) VALUES (?, 'p1', ?, ?, 'manual')");
    expect(() => ins.run("pu0", "bag", 0)).toThrow(/CHECK/);
    ins.run("pu1", "bag", 25000);
    expect(() => ins.run("pu2", "bag", 50000)).toThrow(/UNIQUE/);
  });

  it("enforces one alias text per shop", () => {
    const db = memDb();
    seedBasics(db);
    const ins = db.prepare(
      "INSERT INTO product_aliases (id, shop_id, product_id, alias, alias_norm, source) VALUES (?, 's1', 'p1', ?, ?, 'seed')",
    );
    ins.run("a1", "Chawal", "chawal");
    expect(() => ins.run("a2", "CHAWAL", "chawal")).toThrow(/UNIQUE/);
  });

  it("enforces foreign keys", () => {
    const db = memDb();
    expect(() => db.prepare("INSERT INTO products (id, shop_id, name, base_unit, display_unit) VALUES ('p1','nope','X','g','kg')").run()).toThrow(/FOREIGN KEY/);
  });

  it("makes the ledger append-only (no update, no delete)", () => {
    const db = memDb();
    seedBasics(db);
    txn(db, "t1");
    expect(() => db.prepare("UPDATE inventory_transactions SET delta_base = 5 WHERE id = 't1'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM inventory_transactions WHERE id = 't1'").run()).toThrow(/append-only/);
  });

  it("allows a transaction to be reversed only once", () => {
    const db = memDb();
    seedBasics(db);
    txn(db, "t1");
    txn(db, "r1", { type: "reversal", delta_base: -1000, stock_after_base: 0, source: "undo", reverses_txn_id: "t1" });
    expect(() =>
      txn(db, "r2", { type: "reversal", delta_base: -1000, stock_after_base: 0, source: "undo", reverses_txn_id: "t1" }),
    ).toThrow(/UNIQUE/);
  });

  it("validates transaction type/source and stock_after_base", () => {
    const db = memDb();
    seedBasics(db);
    expect(() => txn(db, "t1", { type: "gift" })).toThrow(/CHECK/);
    expect(() => txn(db, "t2", { source: "llm" })).toThrow(/CHECK/);
    expect(() => txn(db, "t3", { stock_after_base: -1 })).toThrow(/CHECK/);
  });

  it("validates voice_events status, tier and JSON columns", () => {
    const db = memDb();
    seedBasics(db);
    const ins = db.prepare(
      `INSERT INTO voice_events (id, shop_id, user_id, transcript, stt_engine, status, tier, plan)
       VALUES (@id, 's1', 'u1', 'rice 5 bags', 'typed', @status, @tier, @plan)`,
    );
    ins.run({ id: "e1", status: "pending_confirm", tier: "T1", plan: '{"ok":true}' });
    expect(() => ins.run({ id: "e2", status: "done", tier: "T1", plan: null })).toThrow(/CHECK/);
    expect(() => ins.run({ id: "e3", status: "answered", tier: "T9", plan: null })).toThrow(/CHECK/);
    expect(() => ins.run({ id: "e4", status: "answered", tier: "T0", plan: "not json" })).toThrow(/CHECK/);
  });
});
