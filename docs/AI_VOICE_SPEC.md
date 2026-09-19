# AI_VOICE_SPEC — Voice/NLP behaviour

Defines how speech becomes a safe inventory operation. Architecture placement: `ARCHITECTURE.md` §4. Code lives in `src/server/voice/` and `src/shared/`.

## 1. Principles

1. **Separation of concerns.** Speech recognition, language understanding (LLM), inventory reasoning (deterministic), and response wording (templates) are separate stages with typed hand-offs.
2. **The LLM proposes; deterministic code disposes.** The LLM only emits a *RawInterpretation*. It cannot write, cannot invent products, and its output is schema-validated and cross-checked.
3. **Ambiguity is a first-class outcome**, not an error. Unclear → ask. Never guess a write.
4. **Numbers are the highest-risk token** → independently parsed and cross-checked.
5. **Real data or nothing.** Any figure the user hears/sees comes from the DB or an explicit formula over DB rows.
6. **Explain in the user's language**, using their own vocabulary (aliases) where known.

## 2. Pipeline stages and contracts

| # | Stage | Input → Output | Deterministic? | Failure handling |
|---|---|---|---|---|
| 0 | **STT** (client) | audio → `Transcript {text, alternatives[{text,confidence?}], engine, locale}` | no | mic/unsupported → typed input |
| 1 | **Normalise** | text → NFC-normalised, digit-normalised (Devanagari/Telugu digits → ASCII), punctuation-trimmed | yes | — |
| 2 | **Language ID** | text → `{dominant: en|hi|te|other, mixed: boolean, scripts[]}` via Unicode script ranges + lexicon hit counts (no LLM) | yes | `other` → still attempt; reply in shop default |
| 3 | **Interpret** | normalised text (+alts, catalog, pending-clarification context) → `RawInterpretation` | LLM (primary) / rules (fallback) | timeout 6 s / invalid JSON / API error → fallback parser, `interpreter='fallback'` |
| 4 | **Schema validate** | `RawInterpretation` zod parse | yes | invalid → fallback parser |
| 5 | **Numeric cross-check** | deterministic number extraction vs LLM `quantity` per action | yes | mismatch → issue `quantity_mismatch` (T2/T3) |
| 6 | **Resolve** | product text → `product_id` + candidates; unit text → canonical unit; unit+product → `qty_base` | yes | see §6 |
| 7 | **Plan** | resolved actions → `ValidatedPlan` with tier, warnings, questions, `stock_after` preview | yes | see §7–8 |
| 8 | **Confirm/Execute** | user confirm → `InventoryService.apply(plan)` | yes | transactional; rollback on any error |
| 9 | **Respond** | plan/result → localised template text (+ optional TTS P1) | yes | missing template → English |

## 3. Data contracts (zod schemas in `src/shared/interpretation.ts`)

```ts
type Lang = 'en' | 'hi' | 'te';
type CanonicalUnit = 'piece'|'dozen'|'g'|'kg'|'quintal'|'ml'|'litre'|'bag'|'sack'|'box'|'carton'|'packet'|'bottle'|'tin'|'tray';

// ---- Stage 3 output: what the LLM (or fallback) may say. Language understanding only. ----
interface RawInterpretation {
  kind: 'stock_change' | 'query' | 'control' | 'unknown';
  language: { dominant: Lang | 'other'; mixed: boolean };
  actions: RawAction[];                 // 0..5; only for kind='stock_change'
  query?: RawQuery;                     // only for kind='query'
  control?: 'confirm' | 'cancel' | 'undo' | 'answer';  // 'answer' = reply to a pending clarification
  answer?: { product_text?: string; quantity?: number; unit_text?: string; choice_index?: number };
  notes?: string;                       // model's own uncertainty, shown only in logs
}
interface RawAction {
  op: 'add' | 'remove' | 'set' | 'create_product';
  product: { text: string; catalog_id: string | null };   // text = verbatim span; catalog_id = model's guess from provided catalog
  quantity: number | null;              // decimal allowed (2.5)
  unit_text: string | null;             // verbatim ("bastalu", "kilo", "డజను")
  unit: CanonicalUnit | null;           // model's canonicalisation
  price?: { amount: number; per_unit_text?: string } | null;
  spans: { product?: [number, number]; quantity?: [number, number]; unit?: [number, number]; op?: [number, number] }; // char offsets for UI highlight
  confidence: { op: number; product: number; quantity: number; unit: number };   // 0..1, advisory only
}
type RawQuery =
  | { type: 'stock_of'; product_text: string }
  | { type: 'low_stock' }
  | { type: 'reorder_list' }
  | { type: 'days_left'; product_text: string }
  | { type: 'sales_summary'; period: 'today' | 'yesterday' | 'week'; product_text?: string }
  | { type: 'history'; product_text?: string; limit?: number };

// ---- Stage 6–7 output: server-side, trusted, executable only after confirm ----
interface ValidatedPlan {
  eventId: string;
  tier: 'T0' | 'T1' | 'T2' | 'T3';       // §8
  actions: PlannedAction[];
  issues: Issue[];                        // warnings + blockers
  questions: ClarificationQuestion[];     // non-empty ⇒ tier T3, not executable
  card: InterpretationCardModel;          // what UI renders (localised text + structured)
}
interface PlannedAction {
  op: 'add' | 'remove' | 'set' | 'create_product';
  productId: string | null; productName: string;
  spoken: { quantity: number; unit: CanonicalUnit };
  deltaBase: number;                      // signed; for 'set' = target − current, computed at plan time & re-computed at apply
  stockBeforeBase: number; stockAfterBase: number;
  unitPricePaise?: number;
  provenance: { productMatch: 'exact_alias'|'learned_alias'|'fuzzy'|'llm_only'|'user_choice'; score: number };
}
type IssueCode = 'low_confidence' | 'quantity_mismatch' | 'quantity_outlier' | 'fuzzy_product' | 'would_overwrite' | 'new_product' | 'unit_taught_pending';
type BlockerCode = 'product_ambiguous' | 'product_unknown' | 'quantity_missing' | 'op_unclear' | 'unit_missing'
                 | 'unit_undefined' | 'unit_incompatible' | 'exceeds_stock' | 'not_representable' | 'unintelligible';
```

`ValidatedPlan` is persisted server-side in `voice_events.plan`. The client only holds `eventId` + rendered card.

## 4. Language coverage

| Language | P0 | Scripts accepted | Notes |
|---|---|---|---|
| English (en-IN) | yes | Latin | Trade words: bag, carton, dozen, kilo, packet |
| Hindi / Hinglish | yes | Devanagari, romanised | e.g. *aaya/aaye* (came, add), *becha / bik gaya* (sold, remove), *khatam* (finished), *kitna hai* (how much) |
| Telugu / Tenglish | yes | Telugu, romanised | e.g. *vachindi/vacchayi* (came, add), *ammanu/ammesanu* (sold, remove), *ayipoyindi* (finished), *entha undi* (how much is there) |
| Tamil, Kannada, Marathi, Bengali… | P1 | native + romanised | LLM handles; STT locale switch; replies fall back to English until templates exist |

Lexicon files (`src/server/voice/lexicon/{en,hi,te}.ts`) contain, per language and script: number words (0–100, hundred, half/aadha/ardha, one-and-half), unit synonyms, operation verbs/phrases, query phrases, yes/no/cancel words. Used by (a) fallback parser, (b) numeric cross-check, (c) language ID, (d) resolver's unit canonicalisation. **They must be reviewed by a native speaker on the team** (human task) and each entry has a unit test. The LLM is *not* limited to the lexicon.

**Locale hint:** client sets the STT `lang` from the user's selected language chip (default = shop language). Because shopkeepers code-switch, the chip is a *recogniser hint*, not a limit; the pipeline detects language from the text.

## 5. Interpretation rules (encode in prompt AND fallback parser AND tests)

1. **Verb semantics.** *add* ← came/arrived/bought/received/stocked (vachindi, aaya, aaye, "purchase"). *remove* ← sold/used/gave/finished-a-quantity (ammanu, becha, "sold"). *set* ← "now there are N", "stock is N", count corrections, or "finished/ayipoyindi/khatam" (→ set 0, T2).
2. **No verb, only item+quantity** ("Rice 5 bags") → `op` unknown → clarification "Add or remove?" (T3). Never default.
3. **Query vs statement:** interrogatives (entha undi, kitna hai, how much, ?) → query. "Rice undi" (statement of existence, no number) → query stock_of, not a write.
4. **Numbers:** digits or words in any supported language; decimals and "half/aadha"; ranges ("5-6") → ambiguous. Quantity 0 or negative → invalid. "Rice 5 bags 3 bags" → ambiguous.
5. **Units:** unit text is captured verbatim and canonicalised; unknown unit tokens → `unit_missing` clarification, never assumed. "kilo" = kg. "packet" ≠ "piece".
6. **Multiple items:** "Rice 5 bags, oil 2 cartons, sugar 10 kilos vachindi" → 3 actions; a trailing verb applies to all that lack their own. Max 5 actions; more → ask to split.
7. **Product text** is copied verbatim (any script); `catalog_id` is optional and only a hint (§6).
8. **Price** captured if explicit ("at 40 rupees"); stored on the transaction; not otherwise used.
9. **Corrections in the same sentence** ("rice 5 no 6 bags") → take the last value but flag `low_confidence` (T2).
10. **Out-of-domain** ("what's the weather") → `kind: unknown` → friendly "I can help with your stock" + examples.

### Example utterances → expected outcome (seed for the golden set)

| Utterance | Expected |
|---|---|
| "Rice five bags vachindi" | add Rice 5 bag |
| "బియ్యం 5 బస్తాలు వచ్చాయి" | add Rice 5 bag |
| "चावल दस किलो बेच दिया" | remove Rice 10 kg |
| "Oil 2 carton aaya" | add Sunflower Oil 2 carton |
| "Eggs 3 dozen vachayi" | add Eggs 3 dozen → +36 piece |
| "Toor dal ayipoyindi" | set Toor Dal 0 → **T2** (would_overwrite) |
| "Sugar entha undi" | query stock_of Sugar → T0 |
| "Ivvala entha ammanu" / "aaj kitna becha" | query sales_summary today |
| "Kya order karna hai" / "what should I order" | query reorder_list |
| "Rice 5 bags" | **T3** op_unclear |
| "Dal 5 kilo aaye" (Toor & Moong exist) | **T3** product_ambiguous |
| "Sugar 2 bags vachindi" (bag undefined) | **T3** unit_undefined → teach flow |
| "Rice 5 litres vachindi" | **T3** unit_incompatible |
| "Rice 500 bags vachindi" | T2 quantity_outlier |
| "Rice 5 bags, oil 2 cartons, sugar 10 kilos vachindi" | 3 actions, one confirm |
| "cancel" / "undo" | control |

## 6. Resolution (stage 6)

**Product resolution** — `resolveProduct(text, catalog, hint?)`:
1. Normalise: lowercase, strip diacritics/punctuation, Unicode NFC; transliterate Indic script → Latin (simple rule table, P0 covers the catalog vocabulary via seeded aliases rather than general transliteration).
2. Exact match against `alias_norm` (seed + learned + product name) → score 1.0, provenance `exact_alias` / `learned_alias`.
3. Else fuzzy match (normalised Levenshtein ratio + token overlap, plus consonant-skeleton match for romanised Indic spellings like *biyyam/beeyam*) against all aliases.
4. Use the LLM's `catalog_id` hint **only as a tie-breaker or when it agrees with fuzzy**; if the LLM names an id that scores < 0.5 in the deterministic match, ignore it and record `llm_only` disagreement in logs.
5. Decision (constants in `policy.ts`): top score ≥ 0.90 and margin over 2nd ≥ 0.10 → **resolved**; 0.70–0.90 or margin < 0.10 → **candidates** (T2 with chips, or T3 if two near-equal); < 0.70 → **unknown** → offer "Create '<text>' as new item?" (only for `add`) or "I couldn't find that" (T3).

**Unit resolution** — canonicalise via lexicon; then `toBase` (ARCHITECTURE §6). Outcomes: ok · `unit_incompatible` · `unit_undefined` · `unit_missing` · `not_representable`.

**Numeric cross-check (stage 5):** run the deterministic number extractor over the transcript and each STT alternative. If the LLM quantity for an action is not among the extracted numbers (within decimal tolerance) → `quantity_mismatch`. If STT alternatives disagree on the number → `low_confidence`. Both push the plan to **T2** with the competing numbers offered as chips ("5" / "15").

## 7. Ambiguity & clarification design

- A clarification is a **question object**: `{ code, text (localised), options?: [{label, patch}], expects: 'choice'|'number'|'product'|'unit_size' }`.
- Options are tappable; the same question can be answered by voice (`control:'answer'`), interpreted with the pending event as context. Max **2 consecutive clarifications** per event; then offer typed/manual entry.
- Clarification answers are *patches* applied to the stored plan and the plan is fully re-validated; the client never sends final numbers to apply.
- Pending events expire after 10 minutes (`status='expired'`).
- **Teach-once unit flow:** `unit_undefined` → "1 bag of Sugar = how many kg?" → user says/types "50" (or "50 kilos") → `product_units` row (`source='taught'`) → plan continues automatically. Taught sizes are visible/editable in product detail (P1 editing; P0 read-only + manual add through API).

## 8. Confirmation policy (risk tiers)

| Tier | Meaning | Triggers | UX | Executable? |
|---|---|---|---|---|
| **T0** | Read-only | any `query` | Answer card immediately | n/a (no write) |
| **T1** | Standard write | add/remove, all fields resolved with score ≥ 0.90, no issues, quantity plausible | Interpretation Card, one-tap **Confirm** | after tap |
| **T2** | Careful write | any of: `set` (overwrite) · quantity outlier (> 5× median txn size for that product over 30 d with ≥ 3 txns, or absolute > 100 packs) · `quantity_mismatch` · fuzzy product · low STT/LLM confidence (< 0.6 on any field) · `create_product` · taught unit pending | Card with **flagged fields** highlighted amber, primary button reads the *change* explicitly ("Set Rice to 0"), flagged chips must be viewed (button enabled but flagged rows expanded) | after explicit tap |
| **T3** | Blocked | any blocker code | Question card; **no confirm button** until resolved | never until re-planned |

Invariants (tested):
- No write without a `confirm` call on a T1/T2 plan; **no path** from `interpret` to a stock change.
- `exceeds_stock`: a remove larger than current stock is **blocked** (T3) with "Only 3 bags in stock. Fix the stock first?" → offers *Set stock* (T2).
- Multi-action plans take the **highest** tier of any action; blockers on any action block the batch (user can drop that item with an ✕ chip; the rest stays valid).
- Auto-execution of voice writes is **not** implemented in the MVP (even T1). (Revisit only after eval shows unsafe-write rate 0 over a large set.)

## 9. Queries, answers and insights

Read-only executors in `voice/answer.ts` call repositories/domain insights:

| Query | Source | Answer template inputs |
|---|---|---|
| `stock_of` | `products.stock_base` + display formatter | product, qty, unit, status |
| `low_stock` | `insights.statusFor` all products | list with reasons |
| `reorder_list` | `insights.reorderSuggestions` | list with qty + explanation inputs |
| `days_left` | velocity/stock | days, velocity, window |
| `sales_summary` | `Σ sale deltas` by window | per product totals |
| `history` | last N txns | rows |

Answer text = **template + facts** (`templates/{en,hi,te}.ts`): e.g. `te: "{product} stock ఇప్పుడు {qty} {unit} ఉంది."` (Telugu strings to be reviewed by a native speaker). Each template has a unit test with fixed facts. Explanations for reorder always include the inputs: *"~{v} {unit}/day over last {n} days; {stock} left → ~{d} days. Suggest {q} ({packs})."*

P1 option: LLM verbalisation of the same fact payload with a **number guard** (digits in output ⊆ digits in facts) and template fallback.

## 10. LLM integration details (`voice/llm/`)

- Interface: `interface LlmClient { interpret(input: InterpretInput): Promise<RawInterpretation> }`. Adapters: `AnthropicClient` (P0), `FakeLlmClient` (tests, fixture-driven).
- Call: Messages API with **one tool `emit_interpretation`** (input schema = RawInterpretation JSON schema derived from zod) and `tool_choice` forcing it. Temperature 0. `max_tokens` ~800. Timeout 6 s, **no automatic retry** (latency budget) — one immediate fallback to rules.
- System prompt sections: role & safety (you only *interpret*; never invent products; if unsure set low confidence and leave fields null) → rules of §5 → language notes (code-switching examples) → output contract. **Catalog** (id, name, aliases, base unit, known pack units; ≤ ~200 items) is placed in the user turn (it changes per shop) — static parts first so provider prompt caching can apply if the prefix is large enough (verify with the `claude-api` skill at implementation time).
- 10–15 few-shot examples covering en/hi/te/mixed, missing verb, multi-item, queries, controls, and *refusal to guess*.
- Context for follow-ups: if `parentEventId` has pending questions, include them so short answers ("fifty", "the first one", "avunu") parse as `control:'answer'`.
- Log per call: model, latency, input/output tokens, fallback reason. Never log the key.
- Model choice is an **experiment**: run `npm run eval:voice` with Haiku 4.5 first; switch `LLM_MODEL` to `claude-sonnet-5` only if accuracy gates (§12) fail and latency still fits budget. Record result in `DECISIONS.md`.

## 11. Fallback deterministic parser (always shipped)

Scope: single- and multi-item `[product][number][unit][verb]` patterns in en/hi/te lexicons, controls (yes/no/cancel/undo), and 3–4 query shapes (stock of X, low stock, reorder, sold today). Anything else → `unknown` with help text. Same `RawInterpretation` output so the rest of the pipeline is unchanged. It is *real* parsing, labelled "Basic mode" in the UI — it is not a canned-demo path.

## 12. Evaluation (makes "AI quality" measurable)

- `evals/utterances.jsonl`: each row `{id, text, lang, expected: {kind, actions[{op, product, qty, unit}] | query | control, tier}}` against the **seed catalog**.
- Size targets: ≥ 60 rows: en ≥ 12, hi ≥ 15, te ≥ 15, mixed ≥ 15, unsafe/ambiguous ≥ 10 (these expect T3/T2, never T1).
- `npm run eval:voice` runs the pipeline stages 1–7 (real LLM, no DB writes) and reports: intent accuracy, product/qty/unit exact-match per language, tier agreement, latency p50/p95, fallback rate, and **unsafe-write count**.
- **Gates (targets, calibrate in spike S1):** unsafe-write = **0** (hard); intent ≥ 95 %; product+qty+unit ≥ 90 % for en/hi/te; p50 latency ≤ 2.5 s. Failing rows are listed for prompt/lexicon fixes. Utterances added for every bug found in manual testing.
- The offline suite (`npm test`) runs the same rows through the **fallback parser** and recorded fixtures with `FakeLlmClient`, so pipeline logic is CI-testable without network.

## 13. STT handling

- Web Speech: `continuous=false`, `interimResults=true`, `maxAlternatives=3`, `lang` from chip. Interim text streams into the Voice sheet. On end, send `{transcript: best, alternatives}`.
- Errors mapped to plain-language states: `not-allowed` (mic blocked → show how to enable + typed), `no-speech` ("I didn't hear anything"), `network`, `audio-capture`, unsupported browser.
- Engine identity is recorded per event (`stt_engine`) so later comparison is possible when P1 server STT arrives.
- Push-to-talk or tap-to-toggle: **tap to start, auto-stop on silence** (native behaviour); a second tap stops early.

## 14. Text-to-speech (P1)

`speechSynthesis` with `lang` = response language, only if `getVoices()` has a matching voice; otherwise silent (text remains). TTS reads the *result* sentence only, never the whole card. User toggle persisted in localStorage.
