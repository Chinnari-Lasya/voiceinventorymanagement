import type { Database } from "better-sqlite3";
import type { Op, ProductView, StateView, TxnView } from "@/shared/demo";
import { canonicalUnit, formatBase, toBase, toDisplayQty, unitLabel, type BaseUnit } from "./units";

// The ONLY module that changes stock. Every change is a ledger row + cached stock update in one SQLite transaction.
// The voice/interpreter layer only produces proposals; nothing here trusts client-computed numbers.

export const SHOP_ID = "demo-shop";

export interface CatalogProduct {
  id: string;
  name: string;
  category: string | null;
  baseUnit: BaseUnit;
  displayUnit: string;
  stockBase: number;
  thresholdBase: number | null;
  aliases: string[];
}

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  base_unit: BaseUnit;
  display_unit: string;
  stock_base: number;
  low_threshold_base: number | null;
}

const DEMO_PRODUCTS = [
  { id: "p-rice", name: "Rice", cat: "Grains", base: "piece", display: "bag", stock: 20, thr: 10, aliases: ["chawal", "biyyam", "బియ్యం", "चावल"] },
  { id: "p-sugar", name: "Sugar", cat: "Staples", base: "g", display: "kg", stock: 12_000, thr: 10_000, aliases: ["chini", "panchadara", "పంచదార", "చక్కెర", "चीनी", "shakkar"] },
  { id: "p-oil", name: "Oil", cat: "Cooking", base: "piece", display: "bottle", stock: 8, thr: 10, aliases: ["tel", "nune", "నూనె", "तेल"] },
  { id: "p-dal", name: "Dal", cat: "Pulses", base: "g", display: "kg", stock: 15_000, thr: 10_000, aliases: ["dhal", "pappu", "పప్పు", "दाल", "toor"] },
] as const;

/** Seeds the demo shop once (idempotent). Opening stock is recorded in the ledger like any other change. */
export function ensureDemoData(db: Database): void {
  const exists = db.prepare("SELECT 1 FROM shops WHERE id = ?").get(SHOP_ID);
  if (exists) return;
  db.transaction(() => {
    db.prepare("INSERT INTO shops (id, name) VALUES (?, ?)").run(SHOP_ID, "Lakshmi Kirana Store");
    for (const p of DEMO_PRODUCTS) {
      db.prepare(
        "INSERT INTO products (id, shop_id, name, category, base_unit, display_unit, stock_base, low_threshold_base) VALUES (?,?,?,?,?,?,?,?)",
      ).run(p.id, SHOP_ID, p.name, p.cat, p.base, p.display, p.stock, p.thr);
      db.prepare(
        `INSERT INTO inventory_transactions (id, shop_id, product_id, type, delta_base, stock_after_base, source, note)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(crypto.randomUUID(), SHOP_ID, p.id, "opening", p.stock, p.stock, "seed", "demo opening stock");
      for (const a of p.aliases) {
        db.prepare(
          "INSERT INTO product_aliases (id, shop_id, product_id, alias, alias_norm, source) VALUES (?,?,?,?,?,'seed')",
        ).run(crypto.randomUUID(), SHOP_ID, p.id, a, a.normalize("NFC").toLowerCase());
      }
    }
  })();
}

export function getCatalog(db: Database): CatalogProduct[] {
  const rows = db
    .prepare(
      `SELECT id, name, category, base_unit, display_unit, stock_base, low_threshold_base
       FROM products WHERE shop_id = ? AND archived_at IS NULL ORDER BY rowid`,
    )
    .all(SHOP_ID) as ProductRow[];
  const aliasRows = db.prepare("SELECT product_id, alias_norm FROM product_aliases WHERE shop_id = ?").all(SHOP_ID) as {
    product_id: string;
    alias_norm: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    baseUnit: r.base_unit,
    displayUnit: r.display_unit,
    stockBase: r.stock_base,
    thresholdBase: r.low_threshold_base,
    aliases: aliasRows.filter((a) => a.product_id === r.id).map((a) => a.alias_norm),
  }));
}

export function isLow(p: Pick<CatalogProduct, "stockBase" | "thresholdBase">): boolean {
  return p.thresholdBase !== null && p.stockBase < p.thresholdBase;
}

function productView(p: CatalogProduct): ProductView {
  const qty = toDisplayQty(p.displayUnit, p.stockBase);
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? "General",
    qty,
    unit: unitLabel(p.displayUnit, qty),
    displayUnit: p.displayUnit,
    stockText: formatBase(p.displayUnit, p.stockBase),
    low: isLow(p),
    thresholdText: p.thresholdBase === null ? "" : formatBase(p.displayUnit, p.thresholdBase),
    thresholdQty: p.thresholdBase === null ? null : toDisplayQty(p.displayUnit, p.thresholdBase),
  };
}

interface UndoRow {
  id: string;
  product_id: string;
  delta_base: number;
}

/** The most recent purchase/sale that hasn't been undone yet. */
function undoTargetRow(db: Database): UndoRow | undefined {
  return db
    .prepare(
      `SELECT t.id, t.product_id, t.delta_base
       FROM inventory_transactions t
       WHERE t.shop_id = ? AND t.type IN ('purchase','sale')
         AND NOT EXISTS (SELECT 1 FROM inventory_transactions r WHERE r.reverses_txn_id = t.id)
       ORDER BY t.rowid DESC LIMIT 1`,
    )
    .get(SHOP_ID) as UndoRow | undefined;
}

interface TxnRow {
  id: string;
  product_name: string;
  display_unit: string;
  type: string;
  delta_base: number;
  stock_after_base: number;
  source: string;
  note: string | null;
  created_at: string;
  reverted: number;
}

function sourceLabel(source: string, note: string | null): TxnView["sourceLabel"] {
  if (source === "voice") return "Voice";
  if (source === "undo") return "Undo";
  if (source === "seed") return "Seed";
  return note === "typed" ? "Typed" : "Manual";
}

/** Ledger rows, newest first, with product names (including archived products). */
export function getTransactions(db: Database, opts: { limit: number; includeOpening: boolean }): TxnView[] {
  const rows = db
    .prepare(
      `SELECT t.id, p.name AS product_name, p.display_unit, t.type, t.delta_base, t.stock_after_base, t.source, t.note, t.created_at,
              EXISTS (SELECT 1 FROM inventory_transactions r WHERE r.reverses_txn_id = t.id) AS reverted
       FROM inventory_transactions t JOIN products p ON p.id = t.product_id
       WHERE t.shop_id = ? ${opts.includeOpening ? "" : "AND t.type != 'opening'"}
       ORDER BY t.rowid DESC LIMIT ?`,
    )
    .all(SHOP_ID, opts.limit) as TxnRow[];
  const targetId = undoTargetRow(db)?.id;
  return rows.map((r) => ({
    id: r.id,
    productName: r.product_name,
    type: r.type,
    deltaText: `${r.delta_base >= 0 ? "+" : "-"}${formatBase(r.display_unit, Math.abs(r.delta_base))}`,
    stockAfterText: formatBase(r.display_unit, r.stock_after_base),
    kind: r.type === "reversal" ? "undo" : r.delta_base >= 0 ? "add" : "remove",
    source: r.source,
    sourceLabel: sourceLabel(r.source, r.note),
    createdAt: r.created_at,
    reverted: Boolean(r.reverted),
    canUndo: r.id === targetId,
  }));
}

export function getState(db: Database): StateView {
  const shop = db.prepare("SELECT name FROM shops WHERE id = ?").get(SHOP_ID) as { name: string };
  const recent = getTransactions(db, { limit: 8, includeOpening: false });
  const target = undoTargetRow(db);
  let undoTarget: StateView["undoTarget"] = null;
  if (target) {
    const row = getTransactions(db, { limit: 100, includeOpening: false }).find((t) => t.id === target.id);
    undoTarget = { id: target.id, label: row ? `${row.deltaText} ${row.productName}` : "last change" };
  }
  return { shopName: shop.name, products: getCatalog(db).map(productView), recent, undoTarget };
}

export interface ChangeInput {
  productId: string;
  op: Op;
  quantity: number;
  unit: string;
  via: "mic" | "typed";
  userId?: string;
  eventId?: string;
}

export type ChangeResult =
  | { ok: true; message: string; productId: string }
  | { ok: false; code: string; message: string };

/** Validates from scratch (never trusts the client's numbers), then writes ledger row + stock atomically. */
export function applyChange(db: Database, input: ChangeInput): ChangeResult {
  return db.transaction((): ChangeResult => {
    const p = getCatalog(db).find((c) => c.id === input.productId);
    if (!p) return { ok: false, code: "product_not_found", message: "That product doesn't exist." };
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      return { ok: false, code: "bad_quantity", message: "Quantity must be greater than zero." };
    }
    const unit = canonicalUnit(input.unit) ?? input.unit;
    const conv = toBase(p.baseUnit, unit, input.quantity);
    if (!conv.ok) {
      return { ok: false, code: conv.reason, message: `${input.quantity} ${unit} doesn't fit how ${p.name} is counted.` };
    }
    const delta = input.op === "add" ? conv.base : -conv.base;
    const after = p.stockBase + delta;
    if (after < 0) {
      return { ok: false, code: "exceeds_stock", message: `Only ${formatBase(p.displayUnit, p.stockBase)} of ${p.name} in stock.` };
    }
    db.prepare("UPDATE products SET stock_base = ? WHERE id = ?").run(after, p.id);
    db.prepare(
      `INSERT INTO inventory_transactions
         (id, shop_id, product_id, type, delta_base, stock_after_base, qty_entered, unit_entered, source, note, voice_event_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      crypto.randomUUID(), SHOP_ID, p.id, input.op === "add" ? "purchase" : "sale", delta, after,
      input.quantity, unit, input.via === "mic" ? "voice" : "manual", input.via === "typed" ? "typed" : null,
      input.eventId ?? null, input.userId ?? null,
    );
    return { ok: true, productId: p.id, message: `Done. ${p.name} stock is now ${formatBase(p.displayUnit, after)}.` };
  })();
}

/** Undo = a compensating reversal row for the most recent change that hasn't been undone yet. */
export function undoLast(db: Database, userId?: string): ChangeResult {
  return db.transaction((): ChangeResult => {
    const t = undoTargetRow(db);
    if (!t) return { ok: false, code: "nothing_to_undo", message: "Nothing to undo." };
    const p = getCatalog(db).find((c) => c.id === t.product_id);
    if (!p) return { ok: false, code: "product_not_found", message: "That product doesn't exist." };
    const after = p.stockBase - t.delta_base;
    if (after < 0) {
      return { ok: false, code: "would_go_negative", message: "Can't undo — it would make stock negative." };
    }
    db.prepare("UPDATE products SET stock_base = ? WHERE id = ?").run(after, p.id);
    db.prepare(
      `INSERT INTO inventory_transactions
         (id, shop_id, product_id, type, delta_base, stock_after_base, source, reverses_txn_id, created_by)
       VALUES (?,?,?,'reversal',?,?,'undo',?,?)`,
    ).run(crypto.randomUUID(), SHOP_ID, p.id, -t.delta_base, after, t.id, userId ?? null);
    return { ok: true, productId: p.id, message: `Undone. ${p.name} stock is back to ${formatBase(p.displayUnit, after)}.` };
  })();
}
