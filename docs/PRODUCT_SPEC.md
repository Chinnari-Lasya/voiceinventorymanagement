# PRODUCT_SPEC — Voice Inventory Copilot

Status: v1 blueprint. Owner of truth for *what* we build and *for whom*. Architecture is in `ARCHITECTURE.md`, voice behaviour in `AI_VOICE_SPEC.md`, screens in `UX_SPEC.md`.

## 1. Positioning

**AI Voice Inventory Copilot for Indian Small Businesses.**
Working name (placeholder, cheap to change): **Stockbol** ("bol" = speak).

One-line pitch: *Tell your shop's stock what happened, in the way you already talk. It updates the count, checks it back with you, and tells you what to order.*

## 2. Problem (from the challenge) and what we can and cannot claim

Given by the challenge: small businesses in India track stock in notebooks, memory or WhatsApp → shortages, excess, missing items, unclear reorder needs. Existing tools assume typing, English and technical vocabulary.

**Rule:** we have not interviewed shopkeepers. Do not invent statistics, quotes or "surveys" in any deliverable. Everything in §3 is a *labelled assumption* to be validated by any team member who can talk to one real shop owner (tracked as a human task in `PROGRESS.md`). The pitch may say "we designed around these observed patterns" only for patterns that are true of the challenge text itself.

## 3. Users and assumptions

| Persona | Description | Key assumptions (to validate) |
|---|---|---|
| **Primary — Kirana owner ("Lakshmi Kirana Store")** | Runs a neighbourhood grocery. Speaks Telugu/Hindi + some English trade words. Android phone. Restocks from 1–3 distributors. | Speaks to the phone more comfortably than types. Thinks in bags/cartons/dozens/kg, not SKUs. Knows roughly what is low "by feel" but not days-left. Stock arrives in batches; sales are mostly not recorded per-sale. |
| **Secondary — Helper/family member** | Unloads deliveries, sells at the counter. | Less trusted with destructive actions; will use the same login (single-role in MVP). |
| **Non-user (out of scope)** | Multi-branch chains, GST billing, POS-integrated shops. | — |

**Behavioural assumptions that drive design** (validate, but design defensibly either way):
1. Speech is **code-switched** within one sentence (regional grammar + English nouns/units: "Rice five bags vachindi").
2. Speech is **telegraphic** — verbs are often dropped or vague; numbers are the most safety-critical token.
3. Stock is updated in **bursts** (delivery arrives, end of day) rather than per sale. So "remove" is often "sold/used today, N units".
4. Pack sizes vary per product and per distributor; the owner knows them and will tell us **once** if asked well.
5. Trust is earned by **showing what was understood** before changing anything.
6. Connectivity is usually available but flaky; the phone is the only device.

## 4. Scope

### 4.1 Feature priority

P0 = required for a convincing end-to-end demo · P1 = if time permits, in listed order · P2 = stretch/not planned.

| ID | Feature | Pri |
|---|---|---|
| **Voice → stock change** | | |
| F-01 | Voice/typed utterance → interpretation → confirm → ledger update (add / remove / set) | P0 |
| F-02 | Interpretation Card: shows transcript, understood items, per-field editable chips, confidence flags | P0 |
| F-03 | Risk-tiered confirmation (T0–T3, see AI_VOICE_SPEC §8), no silent writes | P0 |
| F-04 | Multi-item utterances (≤5 actions) with one batch confirmation | P0 |
| F-05 | Clarification questions with tap-to-choose answers (also answerable by voice) | P0 |
| F-06 | Undo any recent transaction (compensating reversal) | P0 |
| **Languages** | | |
| F-07 | Understand English, Hindi, Telugu and any mix of them (incl. romanised + native script) | P0 |
| F-08 | Reply in the user's dominant language (deterministic templates for en/hi/te) | P0 |
| F-09 | Additional languages (Tamil, Kannada, Marathi, Bengali) via LLM + STT locale only; templates fall back to English | P1 |
| F-10 | Full UI chrome localisation (en/hi/te); P0 ships English chrome with localised replies | P1 |
| **Units** | | |
| F-11 | Universal units (kg, g, litre, ml, piece, dozen, quintal) with exact integer normalisation | P0 |
| F-12 | Per-product pack units (bag, box, carton, packet, bottle, tin) configured by the business | P0 |
| F-13 | "Teach once": if pack size is unknown, ask ("1 bag of sugar = how many kg?"), save, proceed | P0 |
| F-14 | Mixed display ("3 bags 10 kg") | P1 |
| **Stock & dashboard** | | |
| F-15 | Dashboard: current stock, Needs-attention strip, recent activity, persistent mic | P0 |
| F-16 | Product list with search, product detail (history, units, threshold) | P0 |
| F-17 | Manual correction: +/- stepper and set-quantity on product detail; fix chips on the card | P0 |
| F-18 | Create product by voice/typing (unknown item → "Create 'X'?") | P0 |
| F-19 | Archive product (no hard delete) | P1 |
| **Questions & insights** | | |
| F-20 | Natural-language questions: stock of X, what's low, what to reorder, days left, sold today/this week, recent activity | P0 |
| F-21 | Low-stock alerts (explicit threshold OR velocity-based) with the reason shown | P0 |
| F-22 | Explainable reorder suggestions (velocity × lead time + cover − stock, rounded to packs) with "why" | P0 |
| F-23 | WhatsApp-ready reorder list (share text via `wa.me`) | P1 |
| F-24 | Dead/slow stock insight | P2 |
| **Shop memory** | | |
| F-25 | Learn aliases from user corrections (shop vocabulary) | P0 |
| F-26 | Editable aliases/units in product detail | P1 |
| **Platform** | | |
| F-27 | Basic auth (username + PIN, signed session cookie), single shop per user | P0 |
| F-28 | Transaction ledger + voice event audit log + structured logs | P0 |
| F-29 | Backup script + documented restore | P0 |
| F-30 | Graceful degradation: LLM down → deterministic "Basic mode"; STT unavailable → typed input; all with visible banners | P0 |
| F-31 | Text-to-speech replies (browser `speechSynthesis`, if a voice for the language exists) | P1 |
| F-32 | Server-side STT engine (Sarvam/Whisper) for browsers without Web Speech, or for better Indic accuracy | P1 |
| F-33 | Signup / voice onboarding of an empty shop | P1 |
| F-34 | Voice confirmation ("avunu / haan / yes") | P1 |
| F-35 | Playwright smoke test of the P0 path (typed input) | P1 |
| F-36 | CSV export | P1 |
| F-37 | True offline queue (PWA + local Whisper) | P2 — explicitly *not* planned; see ARCHITECTURE §11 |
| F-38 | Prices/stock valuation, suppliers, GST, barcode scanning, multi-user roles | P2 — not planned |

### 4.2 Non-goals

Billing/POS, GST/invoicing, supplier management, multi-branch, barcode/camera, native mobile apps, accounting. If a request drifts here, refuse and point at this list.

## 5. Functional requirements

Each FR maps to acceptance criteria in `ACCEPTANCE_CRITERIA.md`.

- **FR-1 Stock changes.** The system shall let an authenticated user add, remove, and set stock of a product by voice or typed natural language; every change shall be recorded as an immutable ledger transaction. *(AC-001..)*
- **FR-2 No unsafe writes.** The system shall never modify inventory from an interpretation that is ambiguous, incomplete, dimensionally invalid, or below confidence policy without explicit user resolution. *(AC-003, AC-020..)*
- **FR-3 Transparency.** Before any write, the system shall show the interpreted product, quantity, unit and operation in plain language and the resulting stock after the change. *(AC-010..)*
- **FR-4 Units.** The system shall normalise all quantities to an integer base (piece / g / ml), convert via universal and business-configured rules, and never assume pack sizes. *(AC-030..)*
- **FR-5 Languages.** The system shall interpret English, Hindi and Telugu, in native script or romanised, singly or code-mixed. *(AC-005, AC-040..)*
- **FR-6 Queries.** The system shall answer stock questions from live database state and shall not fabricate figures. *(AC-002, AC-050..)*
- **FR-7 Alerts and reorder.** The system shall flag products that are out/low by threshold or by consumption velocity, and explain the calculation. *(AC-004, AC-060..)*
- **FR-8 Correction.** The user shall be able to correct any interpreted field without typing more than a product name or number, and the correction shall be remembered as shop vocabulary where applicable. *(AC-070..)*
- **FR-9 Reversibility.** Any applied transaction shall be undoable via a reversal transaction, unless undo would make stock negative. *(AC-008, AC-009)*
- **FR-10 Auth.** All data APIs shall require an authenticated session scoped to a shop. *(AC-080..)*
- **FR-11 Reliability.** Failures of STT, LLM or network shall degrade to a working, clearly-labelled mode; transactions shall be atomic. *(AC-090..)*
- **FR-12 Auditability.** Every voice interaction (transcript, interpretation, outcome, latency) shall be logged. *(AC-095)*

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | end-of-speech → Interpretation Card ≤ 3 s at p50 (LLM path); ≤ 400 ms deterministic path. Dashboard refresh after confirm ≤ 300 ms. |
| Mobile | Designed at 360×800, works to 1280 wide. Touch targets ≥ 48 px. Body text ≥ 16 px. |
| Reliability | All stock mutations inside one SQLite transaction; ledger sum equals cached stock (invariant test). |
| Security | Hashed PIN (scrypt), httpOnly signed session, no secrets in client bundle, all inputs zod-validated. |
| Privacy | Audio is **not stored** by us. With Web Speech API the browser vendor's service processes audio; transcripts go to the LLM provider. This must be disclosed in the pitch, not hidden. |
| Operability | One process, one SQLite file, one `.env`. Runs with `npm run dev` on a laptop. |
| Browser support | Chrome on Android + desktop Chrome/Edge are the supported voice targets. Everything else gets typed input. |

## 7. Requirements-gathering traceability (challenge task areas → docs)

| # | Task area | Where addressed |
|---|---|---|
| 1 | Requirements gathering & analysis | §2–3 here (assumptions labelled), `DIFFERENTIATION.md` |
| 2 | Functional requirements | §5 here |
| 3 | Technical design & architecture | `ARCHITECTURE.md`, `DECISIONS.md` |
| 4 | UI/UX design & prototype | `UX_SPEC.md`; the running app is the prototype |
| 5 | Product & stock management | F-11..F-19, ARCHITECTURE §5 |
| 6 | Voice-based stock entry | `AI_VOICE_SPEC.md` |
| 7 | Regional language support | AI_VOICE_SPEC §4–5 |
| 8 | Stock questions & smart alerts | AI_VOICE_SPEC §9, ARCHITECTURE §7 |
| 9 | Final working application | `IMPLEMENTATION_PLAN.md` phases 1–10 |
| 10 | Demo video | Plan phase 12; script in §8 below |
| 11 | Solution presentation | Plan phase 12 |
| 12 | Business pitch deck | Plan phase 12 (outline in `IMPLEMENTATION_PLAN.md` §Phase 12) |

## 8. Demo storyline (the P0 path — everything must serve this)

Seeded shop: **Lakshmi Kirana Store**, ~15 products, 30 days of synthetic (clearly labelled demo) sales history. `npm run seed` resets it deterministically.

1. **Open** → dashboard already shows stock, a *Needs attention* strip (e.g. "Toor Dal · ~2 days left"), recent activity, big mic.
2. **Speak (mixed):** "Rice five bags vachindi" → live transcript appears.
3. **Interpretation Card:** "Add **5 bags** of **Rice**. Stock will be **23 bags**." Understood words highlighted. **Confirm.**
4. **Dashboard updates** instantly; activity feed shows the entry; reply: "Done. Rice stock is now 23 bags."
5. **Unit teaching:** "Sugar two bags vachindi" → "1 bag of Sugar = how many kg?" → "fifty" → saved → card "Add 2 bags (100 kg) of Sugar" → confirm.
6. **Unit maths:** "Eggs three dozen vachayi" → "+36 pieces (3 dozen)".
7. **Safety:** say "Dal five kilo aaye" → two dals exist → "Which one? Toor Dal / Moong Dal" — nothing changed.
8. **Question:** "Ivvala entha ammanu?" (Telugu) / "Kya order karna hai?" (Hindi) → answer computed from DB; opens the reorder list.
9. **Explainable insight:** "Toor Dal: you sell ~4 kg/day, 9 kg left → ~2 days. Suggest 30 kg (≈ 1 bag)."
10. **Correction & memory:** mis-heard product → tap chip → pick Rice → next time "biyyam" resolves without asking.
11. **Undo** the last entry.

**Backup demo path** (mic, network or LLM failure): same storyline typed via the text box or the demo phrase chips (`?demo=1`). Chips inject *text into the real pipeline* — never canned results. If the LLM is down, Basic mode handles scripted phrases via the deterministic parser. Last resort: pre-recorded screen capture (made in Phase 12 *before* the live demo).
