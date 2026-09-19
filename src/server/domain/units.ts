// Pure unit helpers (no I/O). Stock is stored as an integer in a base unit: piece | g | ml.
//
// DEMO SIMPLIFICATION: for piece-based products one bag/bottle/packet counts as 1 piece.
// Real per-product pack sizes ("1 bag = 25 kg") live in `product_units` (ARCHITECTURE §6) and are not
// wired into this demo; pack sizes are never guessed for weight/volume products.

export type BaseUnit = "piece" | "g" | "ml";

const UNIT_WORDS: Record<string, string[]> = {
  bag: ["bag", "bags", "sack", "sacks", "bastalu", "bastha", "basta", "bosta", "bori", "bora", "బస్తా", "బస్తాలు", "బస్తాల", "बोरी", "बोरा", "बैग"],
  bottle: ["bottle", "bottles", "seesa", "సీసా", "సీసాలు", "बोतल"],
  kg: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "కిలో", "కిలోలు", "किलो"],
  g: ["g", "gm", "gms", "gram", "grams", "గ్రాములు", "ग्राम"],
  piece: ["piece", "pieces", "pcs", "pc"],
  packet: ["packet", "packets", "pkt", "pkts"],
  litre: ["litre", "litres", "liter", "liters", "ltr", "l"],
  ml: ["ml"],
  dozen: ["dozen", "dozens", "darjan", "డజను", "दर्जन"],
};

const WORD_TO_UNIT = new Map<string, string>();
for (const [unit, words] of Object.entries(UNIT_WORDS)) for (const w of words) WORD_TO_UNIT.set(w, unit);

/** Canonical unit for a spoken/typed token, or null if it isn't a unit word. */
export function canonicalUnit(token: string): string | null {
  return WORD_TO_UNIT.get(token) ?? null;
}

export type ToBase = { ok: true; base: number } | { ok: false; reason: "incompatible" | "fraction" };

const COUNTED = new Set(["bag", "bottle", "packet", "piece"]);

export function toBase(baseUnit: BaseUnit, unit: string, qty: number): ToBase {
  let factor: number | null = null;
  if (baseUnit === "g") factor = unit === "kg" ? 1000 : unit === "g" ? 1 : null;
  else if (baseUnit === "ml") factor = unit === "litre" ? 1000 : unit === "ml" ? 1 : null;
  else factor = COUNTED.has(unit) ? 1 : unit === "dozen" ? 12 : null;
  if (factor === null) return { ok: false, reason: "incompatible" };
  const exact = qty * factor;
  const base = Math.round(exact);
  if (Math.abs(exact - base) > 1e-9) return { ok: false, reason: "fraction" };
  return { ok: true, base };
}

const PLURALISABLE = new Set(["bag", "bottle", "packet", "piece", "dozen", "litre"]);

export function unitLabel(unit: string, qty: number): string {
  return PLURALISABLE.has(unit) && qty !== 1 ? `${unit}s` : unit;
}

function displayFactor(displayUnit: string): number {
  return displayUnit === "kg" || displayUnit === "litre" ? 1000 : displayUnit === "dozen" ? 12 : 1;
}

export function toDisplayQty(displayUnit: string, base: number): number {
  return Number((base / displayFactor(displayUnit)).toFixed(2));
}

/** "20 bags", "12 kg" — base quantity rendered in the product's display unit. */
export function formatBase(displayUnit: string, base: number): string {
  const q = toDisplayQty(displayUnit, base);
  return `${q} ${unitLabel(displayUnit, q)}`;
}
