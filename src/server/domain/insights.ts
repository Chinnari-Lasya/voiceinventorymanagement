import type { Database } from "better-sqlite3";
import type { InsightItem } from "@/shared/demo";
import { SHOP_ID, getCatalog, isLow } from "./inventory";
import { formatBase, toDisplayQty, unitLabel } from "./units";

// Deterministic insights: every line is a plain rule over the product's alert level and its own ledger.
// Rule for the suggestion: order enough to bring stock back to 2x the alert level.

const WINDOW_DAYS = 14;

function soldBase(db: Database, productId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(-t.delta_base), 0) AS sold FROM inventory_transactions t
       WHERE t.product_id = ? AND t.shop_id = ? AND t.type = 'sale'
         AND t.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)
         AND NOT EXISTS (SELECT 1 FROM inventory_transactions r WHERE r.reverses_txn_id = t.id)`,
    )
    .get(productId, SHOP_ID, `-${WINDOW_DAYS} days`) as { sold: number };
  return row.sold;
}

export function getInsights(db: Database): { items: InsightItem[]; lowCount: number } {
  const items: InsightItem[] = getCatalog(db).map((p) => {
    const stockText = formatBase(p.displayUnit, p.stockBase);
    const thresholdText = p.thresholdBase === null ? "" : formatBase(p.displayUnit, p.thresholdBase);
    const out = p.stockBase === 0;
    const low = isLow(p);
    const status: InsightItem["status"] = out ? "out" : low ? "low" : "ok";
    const why: string[] = [];
    let headline: string;
    let suggestion: string | null = null;

    if (p.thresholdBase === null) {
      headline = `${p.name} has no low-stock level set.`;
      why.push("Set an alert level in Inventory → Edit to get warnings for this product.");
    } else if (status === "ok") {
      headline = `${p.name} is well stocked.`;
      why.push(`Stock is ${stockText}, at or above your alert level of ${thresholdText}.`);
    } else {
      headline = out
        ? `${p.name} is out of stock.`
        : `${p.name} is below your threshold of ${thresholdText}.`;
      why.push(`You have ${stockText}; your alert level is ${thresholdText}.`);
    }

    const sold = soldBase(db, p.id);
    if (sold > 0) {
      const perDay = sold / WINDOW_DAYS;
      const daysLeft = perDay > 0 ? p.stockBase / perDay : null;
      why.push(
        `You recorded ${formatBase(p.displayUnit, sold)} sold in the last ${WINDOW_DAYS} days (about ${formatBase(p.displayUnit, Math.round(perDay))} a day)` +
          (daysLeft !== null ? `, so ${stockText} lasts roughly ${Math.max(0, Math.round(daysLeft))} days.` : "."),
      );
    } else if (status !== "ok") {
      why.push(`No sales recorded in the last ${WINDOW_DAYS} days, so this uses your alert level only.`);
    }

    if (p.thresholdBase !== null && status !== "ok") {
      const target = p.thresholdBase * 2;
      const need = Math.ceil(toDisplayQty(p.displayUnit, target - p.stockBase));
      suggestion = `Order about ${need} ${unitLabel(p.displayUnit, need)} to bring ${p.name} back to ${formatBase(p.displayUnit, target)}.`;
      why.push(`Suggestion rule: restock to 2× your alert level (${formatBase(p.displayUnit, target)}).`);
    }

    return { productId: p.id, name: p.name, status, stockText, thresholdText, headline, why, suggestion };
  });

  const order = { out: 0, low: 1, ok: 2 } as const;
  items.sort((a, b) => order[a.status] - order[b.status]);
  return { items, lowCount: items.filter((i) => i.status !== "ok").length };
}
