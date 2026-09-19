import type { InterpretationView, Op } from "@/shared/demo";
import { isLow, type CatalogProduct } from "@/server/domain/inventory";
import { canonicalUnit, formatBase, toBase, unitLabel } from "@/server/domain/units";

// Deterministic command interpreter (English / Hindi / Telugu words, romanised or native script).
// It only PROPOSES a change. It never touches the database; writes happen after the user confirms.
// If it can't be sure (no verb, both verbs, unknown/ambiguous product, no number) it refuses rather than guessing.

export type InterpretResult =
  | { ok: true; interpretation: InterpretationView }
  | { ok: false; code: string; message: string };

const ADD_WORDS = new Set([
  "add", "added", "adding", "plus", "received", "receive", "came", "arrived", "bought", "buy", "purchase", "purchased", "stocked", "restock", "got", "get", "gets", "come", "comes", "coming", "increase", "increased", "bring", "brought",
  "vachindi", "vachhindi", "vacchindi", "vachayi", "vachai", "vachhayi", "vacchayi", "yad", "జోడించు", "వచ్చింది", "వచ్చాయి", "యాడ్",
  "aaya", "aaye", "jodo", "jodna", "जोड़ें", "जोड़ो", "आया", "आए",
]);
const REMOVE_WORDS = new Set([
  "remove", "removed", "minus", "deduct", "sold", "sell", "sale", "used", "gave", "less", "reduce", "subtract", "delete", "gone", "went", "decrease", "decreased", "spent",
  "ammanu", "ammesanu", "ammaanu", "teesey", "teesei", "tisey", "అమ్మాను", "అమ్మేశాను", "తీసేయి", "తీసివేయి", "తీసేయ్",
  "becha", "bech", "hatao", "nikalo", "बेचा", "बेच", "हटाओ", "निकालो",
]);

const ADD_PHRASES = ["came in", "come in", "got from", "bought", "received", "stock came", "stock arrived"];
const REMOVE_PHRASES = ["went out", "sold out", "gave away", "used up", "ran out", "stock went", "stock sold"];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50,
  okati: 1, rendu: 2, moodu: 3, mudu: 3, nalugu: 4, aidu: 5, aaru: 6, edu: 7, enimidi: 8, tommidi: 9, padi: 10,
  ఒకటి: 1, రెండు: 2, మూడు: 3, నాలుగు: 4, ఐదు: 5, ఆరు: 6, ఏడు: 7, ఎనిమిది: 8, తొమ్మిది: 9, పది: 10,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
};

const DIGIT_MAPS: [RegExp, number][] = [
  [/[०-९]/g, 0x0966],
  [/[౦-౯]/g, 0x0c66],
];

function tokenize(text: string): string[] {
  let t = text.normalize("NFC").toLowerCase();
  for (const [re, zero] of DIGIT_MAPS) t = t.replace(re, (d) => String(d.charCodeAt(0) - zero));
  return t
    .split(/[^\p{L}\p{N}\p{M}.]+/u)
    .map((x) => x.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

function parseNumber(tok: string): number | null {
  if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok);
  return Object.hasOwn(NUMBER_WORDS, tok) ? NUMBER_WORDS[tok] : null;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function findProducts(tokens: string[], catalog: CatalogProduct[]): CatalogProduct[] {
  const exact = catalog.filter((p) => {
    const names = [p.name.toLowerCase(), ...p.aliases];
    return tokens.some((t) => names.includes(t));
  });
  if (exact.length > 0) return exact;
  // Typo tolerance only for reasonably long words, so short verbs are never mistaken for products.
  return catalog.filter((p) =>
    [p.name.toLowerCase(), ...p.aliases].some(
      (n) => n.length >= 4 && tokens.some((t) => t.length >= 4 && editDistanceAtMostOne(t, n)),
    ),
  );
}

const fail = (code: string, message: string): InterpretResult => ({ ok: false, code, message });

export function interpret(text: string, catalog: CatalogProduct[]): InterpretResult {
  const normalizedText = text.normalize("NFC").toLowerCase();
  const tokens = tokenize(text);
  if (tokens.length === 0) return fail("empty", "Type or say a command, like “Add 5 bags of rice”.");

  const adds = tokens.filter((t) => ADD_WORDS.has(t)).length + ADD_PHRASES.filter((p) => normalizedText.includes(p)).length;
  const removes = tokens.filter((t) => REMOVE_WORDS.has(t)).length + REMOVE_PHRASES.filter((p) => normalizedText.includes(p)).length;
  if (adds > 0 === removes > 0) {
    return fail(
      "op_unclear",
      adds > 0 ? "I heard both stock coming in and going out. Which one did you mean? Nothing was changed." : "I can understand natural phrases, but I need to know whether stock came in or went out. Try “rice came in” or “rice was sold”. Nothing was changed.",
    );
  }
  const op: Op = adds > 0 ? "add" : "remove";

  const matches = findProducts(tokens, catalog);
  if (matches.length === 0) {
    return fail("product_unknown", `I couldn't find that product. You have: ${catalog.map((c) => c.name).join(", ")}.`);
  }
  if (matches.length > 1) {
    return fail("product_ambiguous", `Which one — ${matches.map((m) => m.name).join(" or ")}? Nothing was changed.`);
  }
  const product = matches[0];

  const quantity = tokens.map(parseNumber).find((n) => n !== null) ?? null;
  if (quantity === null) return fail("quantity_missing", `How many? Try “add 5 bags of ${product.name.toLowerCase()}”.`);
  if (quantity <= 0) return fail("bad_quantity", "Quantity must be greater than zero.");

  const spokenUnit = tokens.map(canonicalUnit).find((u) => u !== null) ?? null;
  const unit = spokenUnit ?? product.displayUnit;

  const conv = toBase(product.baseUnit, unit, quantity);
  if (!conv.ok) {
    return fail(
      conv.reason === "fraction" ? "not_representable" : "unit_incompatible",
      conv.reason === "fraction"
        ? `I can't ${op} a fraction of a ${unit} of ${product.name}.`
        : `${product.name} is counted in ${unitLabel(product.displayUnit, 2)}, so “${quantity} ${unit}” doesn't fit. Try “${quantity} ${unitLabel(product.displayUnit, quantity)}”.`,
    );
  }

  const delta = op === "add" ? conv.base : -conv.base;
  const after = product.stockBase + delta;
  if (after < 0) {
    return fail(
      "exceeds_stock",
      `Only ${formatBase(product.displayUnit, product.stockBase)} of ${product.name} in stock, so I can't remove that much.`,
    );
  }

  return {
    ok: true,
    interpretation: {
      productId: product.id,
      productName: product.name,
      op,
      quantity,
      unit,
      unitAssumed: spokenUnit === null,
      summary: `${op === "add" ? "Add" : "Remove"} ${quantity} ${unitLabel(unit, quantity)} of ${product.name}`,
      stockBeforeText: formatBase(product.displayUnit, product.stockBase),
      stockAfterText: formatBase(product.displayUnit, after),
      willBeLow: isLow({ stockBase: after, thresholdBase: product.thresholdBase }),
    },
  };
}
