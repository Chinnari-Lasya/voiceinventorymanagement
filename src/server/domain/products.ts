import type { Database } from "better-sqlite3";
import { SHOP_ID } from "./inventory";
import { toBase, type BaseUnit } from "./units";

// Product management (create / edit / archive). Stock changes for existing products still go through inventory.ts;
// creating a product with opening stock writes an 'opening' ledger row in the same transaction.

export const PRODUCT_UNITS = ["bag", "kg", "g", "bottle", "packet", "piece", "litre", "ml"] as const;

const BASE_OF: Record<string, BaseUnit> = { bag: "piece", bottle: "piece", packet: "piece", piece: "piece", kg: "g", g: "g", litre: "ml", ml: "ml" };

export type ProductResult<T = object> = ({ ok: true } & T) | { ok: false; code: string; message: string };

const err = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
const isUnique = (e: unknown) => String(e).includes("UNIQUE");

export interface NewProduct {
  name: string;
  category: string;
  unit: string;
  initialStock: number;
  threshold: number | null; // in `unit`
  userId?: string;
}

export function createProduct(db: Database, input: NewProduct): ProductResult<{ id: string }> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) return err("bad_name", "Product name must be 1–60 characters.");
  const base = BASE_OF[input.unit];
  if (!base) return err("bad_unit", "Choose a unit from the list.");
  if (!Number.isFinite(input.initialStock) || input.initialStock < 0) return err("bad_stock", "Initial stock can't be negative.");

  const stock = toBase(base, input.unit, input.initialStock);
  if (!stock.ok) return err("bad_stock", `Initial stock must be a whole number of ${input.unit}s.`);
  let thresholdBase: number | null = null;
  if (input.threshold !== null) {
    const t = toBase(base, input.unit, input.threshold);
    if (!Number.isFinite(input.threshold) || input.threshold < 0 || !t.ok) return err("bad_threshold", "Low-stock level must be a valid, non-negative number.");
    thresholdBase = t.base;
  }

  const id = `p-${crypto.randomUUID().slice(0, 8)}`;
  try {
    db.transaction(() => {
      db.prepare(
        "INSERT INTO products (id, shop_id, name, category, base_unit, display_unit, stock_base, low_threshold_base) VALUES (?,?,?,?,?,?,?,?)",
      ).run(id, SHOP_ID, name, input.category.trim() || null, base, input.unit, stock.base, thresholdBase);
      if (stock.base > 0) {
        db.prepare(
          `INSERT INTO inventory_transactions (id, shop_id, product_id, type, delta_base, stock_after_base, qty_entered, unit_entered, source, note, created_by)
           VALUES (?,?,?,'opening',?,?,?,?,'manual','initial stock',?)`,
        ).run(crypto.randomUUID(), SHOP_ID, id, stock.base, stock.base, input.initialStock, input.unit, input.userId ?? null);
      }
      // Multi-word names: let the voice interpreter match on each word (it compares single tokens).
      const words = name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
      if (words.length > 1) {
        for (const w of words) {
          db.prepare(
            "INSERT OR IGNORE INTO product_aliases (id, shop_id, product_id, alias, alias_norm, source) VALUES (?,?,?,?,?,'manual')",
          ).run(crypto.randomUUID(), SHOP_ID, id, w, w.normalize("NFC"));
        }
      }
    })();
  } catch (e) {
    if (isUnique(e)) return err("duplicate", `You already have a product called “${name}”.`);
    throw e;
  }
  return { ok: true, id };
}

export interface ProductPatch {
  name?: string;
  category?: string;
  threshold?: number | null; // in the product's display unit; null clears the alert level
}

export function updateProduct(db: Database, id: string, patch: ProductPatch): ProductResult {
  const p = db
    .prepare("SELECT base_unit, display_unit FROM products WHERE id = ? AND shop_id = ? AND archived_at IS NULL")
    .get(id, SHOP_ID) as { base_unit: BaseUnit; display_unit: string } | undefined;
  if (!p) return err("not_found", "That product doesn't exist.");

  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (n.length < 1 || n.length > 60) return err("bad_name", "Product name must be 1–60 characters.");
    sets.push("name = ?");
    vals.push(n);
  }
  if (patch.category !== undefined) {
    sets.push("category = ?");
    vals.push(patch.category.trim() || null);
  }
  if (patch.threshold !== undefined) {
    if (patch.threshold === null) {
      sets.push("low_threshold_base = NULL");
    } else {
      const t = toBase(p.base_unit, p.display_unit, patch.threshold);
      if (!Number.isFinite(patch.threshold) || patch.threshold < 0 || !t.ok) return err("bad_threshold", "Low-stock level must be a valid, non-negative number.");
      sets.push("low_threshold_base = ?");
      vals.push(t.base);
    }
  }
  if (sets.length === 0) return { ok: true };
  try {
    db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  } catch (e) {
    if (isUnique(e)) return err("duplicate", "You already have a product with that name.");
    throw e;
  }
  return { ok: true };
}

/** Archive = hide from the catalog and voice matching; ledger history is kept intact. */
export function archiveProduct(db: Database, id: string): ProductResult {
  const res = db
    .prepare("UPDATE products SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND shop_id = ? AND archived_at IS NULL")
    .run(id, SHOP_ID);
  return res.changes > 0 ? { ok: true } : err("not_found", "That product doesn't exist.");
}
