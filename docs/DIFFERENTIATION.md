# DIFFERENTIATION

Everyone gets the same problem statement. This doc records what a typical team will build, what we build instead, and how each difference is shown and built. Every differentiator must strengthen the core loop (speak → understand → show → confirm → execute → explain → surface insight); anything that doesn't is cut.

## 1. Baseline solution (what the problem statement literally asks)

Login → product table → microphone button → speech-to-text → keyword/regex or single LLM call → add/remove quantity → table refreshes → low-stock badge when qty < N → chart or two.

## 2. Likely common hackathon implementation

- Inventory CRUD app with a mic button and a text box "voice command".
- Speech via Web Speech API in English (maybe one regional language demo), result applied **immediately**.
- LLM prompt "extract JSON" → written straight to DB; hard-coded units ("bag" = "kg" or ignored).
- Static low-stock threshold; "AI insights" that are canned text or generic charts.
- Success shown as a toast; no undo; no explanation of what was understood; demo works only with the exact rehearsed phrase.

## 3. Product thesis

> A shopkeeper doesn't want an *app*; they want to say what happened in their own words and be sure the count is right — and be told what to buy before they run out.

Trust is the product. Speech and LLMs are error-prone; the winning system is the one that **makes errors visible, cheap to fix, and impossible to make silently**, while feeling effortless when it's right. Everything intelligent runs on the shop's *real* ledger.

## 4. Differentiators (5, ranked)

### D1 — "Understand-before-act": Interpretation Card + risk-tiered confirmation + undo
- **What:** Each utterance becomes a card showing transcript, product/quantity/unit chips, before→after stock, and flagged doubts; writes need an explicit tap; risk tiers (T1–T3) decide how careful; ambiguous input becomes a question, never a guess; every entry has Undo.
- **Why it matters to the user:** a wrong voice entry silently corrupts stock and destroys trust; this makes mistakes obvious and reversible.
- **Demo:** speak "Dal 5 kilo aaye" → question "Toor or Moong?"; speak "Toor dal ayipoyindi" → amber "Set Toor Dal to 0"; tap Undo.
- **Complexity:** Medium (planner, tiers, card UI, patch flow). **Demo impact:** Very high. **Priority: P0.**

### D2 — Code-switched, multi-script understanding grounded in the shop's catalog, with numeric cross-check
- **What:** English/Hindi/Telugu mixed in one sentence, native or romanised script, resolved against *this shop's* products and aliases; LLM interpretation cross-checked by an independent deterministic number parser + STT alternatives so "5" vs "15" is caught.
- **Why:** it's how the user actually speaks; numbers are where voice systems silently fail.
- **Demo:** "Rice five bags vachindi", "బియ్యం 5 బస్తాలు వచ్చాయి", "चावल दस किलो बेच दिया", multi-item sentence; show a flagged "Heard 5 and 15" card.
- **Complexity:** Medium-High (prompt, lexicons, resolver, eval set). **Impact:** Very high. **Priority: P0.**

### D3 — Shop memory: teach-once units and self-learning vocabulary
- **What:** no assumed pack sizes. First "2 bags sugar" → app asks "1 bag = how many kg?" → remembers. Corrections ("that 'biyyam' is Rice") become aliases; later resolves instantly. Configurable business units, not a fixed dropdown.
- **Why:** trade units mean different things per product/distributor; typing setup forms is the exact friction we're removing — teaching by conversation removes onboarding.
- **Demo:** ask → answer "fifty" → card "2 bags (100 kg)"; correct a mis-heard product once, repeat the phrase and watch it resolve with no question (`use_count` increments).
- **Complexity:** Medium (units table, teach flow, alias learning). **Impact:** High. **Priority: P0.**

### D4 — Explainable reorder intelligence from the real ledger
- **What:** consumption velocity from actual sales entries → days-left → low status and reorder quantity rounded to the shop's pack sizes, each with a "Why?" showing the numbers. Works even when the owner never set a threshold.
- **Why:** owners know "low by feel"; they need *when it runs out* and *how much to order*, and must trust the number.
- **Demo:** "Kya order karna hai?" → list; open Toor Dal → "~4 kg/day over 14 days; 9 kg left → ~2 days; suggest 30 kg (1 bag)". Change stock via voice → recompute live. Seed data is labelled synthetic; formulas are real and unit-tested.
- **Complexity:** Low-Medium (deterministic maths). **Impact:** High. **Priority: P0.**

### D5 — Degrades gracefully and says so (Basic mode) + honest "AI boundaries"
- **What:** LLM/STT/network failures route to a deterministic parser and typed input with a visible banner; the LLM can never write to the DB; every interaction is logged to an audit table.
- **Why:** real shops have flaky connectivity; reliability is what makes owners keep using it. It's also the answer to "isn't AI risky for inventory?".
- **Demo:** kill the API key live → banner "Basic mode" → same phrase still works via rules; complex phrase asks for help instead of guessing.
- **Complexity:** Low-Medium (fallback parser is already required). **Impact:** Medium (high for judges probing reliability). **Priority: P0 (fallback), banner P0.**

## 5. Considered and deliberately *not* chosen

| Idea | Why not |
|---|---|
| True offline mode (PWA + local Whisper) | Heavy models, weak Telugu at small sizes, large risk; would consume the schedule. We state the limitation instead of faking it. |
| Barcode/camera scanning | Different problem; not voice; kirana items often lack barcodes on loose goods. |
| Analytics dashboards (charts galore) | Doesn't serve the core loop; sparkline + attention strip are enough. |
| Auto-executing voice commands | Contradicts D1; unsafe until eval proves it. |
| Voice-cloned/conversational agent with long dialogue | Latency and unpredictability; our interactions are short and structured. |
| Supplier ordering integrations / GST | Out of scope; WhatsApp-share of the reorder list (P1) covers the real workflow cheaply. |
| Many languages at launch | Three languages done well beats ten done badly; others are P1 via the same LLM path. |

## 6. Summary matrix

| # | Differentiator | Complexity | Demo impact | Priority | Depends on |
|---|---|---|---|---|---|
| D1 | Understand-before-act (card, tiers, undo) | M | Very high | P0 | planner, InventoryService, card UI |
| D2 | Code-switch + cross-check | M-H | Very high | P0 | lexicons, LLM, resolver, eval set |
| D3 | Shop memory (units + aliases) | M | High | P0 | units tables, teach flow |
| D4 | Explainable reorder | L-M | High | P0 | ledger + seeded history |
| D5 | Graceful degradation & audit | L-M | Medium | P0 | fallback parser |

## 7. Pitch narrative (one line each)

1. *Problem:* notebooks and memory → stock-outs and over-stock, and existing apps demand typing/English.
2. *Insight:* trust, not transcription, is the barrier — voice must show and confirm.
3. *Solution:* a copilot that understands how shopkeepers speak, proves it understood, learns the shop, and tells you what to order — using only real data.
4. *Why us:* the safety architecture (LLM proposes, deterministic core disposes), measurable accuracy (eval set), and a working end-to-end product.
5. *Business:* deferred to the pitch deck (Phase 12); do not invent market-size numbers without a cited source.
