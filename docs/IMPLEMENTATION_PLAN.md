# IMPLEMENTATION_PLAN

Hackathon prototype, limited Claude Code context. Work is organised into **execution milestones M0–M7**. Each milestone ends in a green `npm run check` and a Git checkpoint, so a fresh session can resume from `CLAUDE.md` + `docs/PROGRESS.md` + `git log`. Big milestones are split into **slices** with their own commit so a context reset never loses more than one slice.

Standard scripts (created in M1, used by every later verification): `npm run dev | build | start | typecheck | lint | test | check` (`check` = typecheck + lint + test) · `npm run seed | backup | restore` · `npm run eval:voice` (M5+).

## Ground rules that every milestone obeys

1. **The LLM never modifies inventory.** It exists only in `src/server/voice/llm/` and returns a `RawInterpretation`. It has no DB handle and no write tools. Stock changes flow: `planner → ValidatedPlan (stored server-side) → user confirm → InventoryService.applyChanges()`.
2. **Domain is independent of voice.** `src/server/domain/*` (units, inventory, insights, policy) is built and fully tested in M2 with **zero** imports from `voice/`, `http/`, `app/` or any LLM SDK. `InventoryService.applyChanges(shopId, StockChange[], meta)` takes plain domain commands; the voice layer *adapts* a plan into them, never the reverse.
3. **No scope expansion.** Only P0 items from `PRODUCT_SPEC` §4.1 appear here. Nothing else gets built until after M7.
4. **No new libraries** beyond the allowlist in `CLAUDE.md` §Dependency rules.
5. Each milestone's **"Not yet"** list is binding.
6. Safety architecture (confirm gate, tiers T0–T3, number cross-check, patches-not-deltas, idempotent confirm, undo, audit log) is preserved exactly as specified in `AI_VOICE_SPEC` §8 and `ARCHITECTURE` §4/§9.

## Milestone overview

| M | Name | First point at which… | Est. sessions* |
|---|---|---|---|
| **M0** | Documentation + repository checkpoint | blueprint is committed on `main` | 0.2–0.5 |
| **M1** | Foundation + database + health endpoint | app runs; DB migrates; health OK | 1 |
| **M2** | Inventory ledger + products + deterministic business logic | stock/units/insights are proven by tests (no UI) | 1–1.5 |
| **M3** | Dashboard + product management + transactions + undo | a shopkeeper can use the app *manually* on a phone | 2 |
| **M4** | Voice pipeline + interpretation card + confirmation flow | **first demoable vertical slice** | 2–3 |
| **M5** | Multilingual intelligence + aliases + fallback parser | Hindi/Telugu/mixed + memory + Basic mode + eval numbers | 1.5–2 |
| **M6** | Reorder intelligence + explainability + audit trail | questions, reorder "Why?", voice log | 1–1.5 |
| **M7** | Demo hardening + testing + deployment + demo mode | **P0 complete**, rehearsed, backed up | 1–1.5 |
| — | Submission assets (video, slides, pitch) — parallel track, not a code milestone | | 1–2 |

*A "session" = one focused Claude Code context window. Total ≈ **10–13 build sessions** + 1–2 for assets.

**Parallel human tasks** (tracked in `PROGRESS.md`): H1 API key (before M4) · H2 S1 Web Speech phone test (before M4 ends) · H3 native review of te/hi strings (during M5) · H5 tunnel test (before M4 demo run) · H7 backup video (right after M4).

---

## M0 — Documentation + repository checkpoint

- **Objective:** freeze the blueprint as the first commit so every later session has a stable base.
- **Files:** `CLAUDE.md`, `docs/{PRODUCT_SPEC,ARCHITECTURE,AI_VOICE_SPEC,UX_SPEC,DIFFERENTIATION,IMPLEMENTATION_PLAN,ACCEPTANCE_CRITERIA,PROGRESS,DECISIONS}.md` (all exist). Modify: nothing except fixing any inconsistency found in a final read.
- **Acceptance:** all 10 files present; milestone/AC references resolve (use §Legacy map for older "Phase N" mentions); `CLAUDE.md` starts with the required header; no secrets or stray files.
- **Verify:** `git status` · `git ls-files` (after commit) shows exactly the 10 files · `git log --oneline` shows one commit.
- **Not yet:** `package.json`, `.gitignore`, `.env*`, any source, any dependency install.
- **Expected completion state:** clean tree on branch `main`; docs are the only content.
- **Git checkpoint:** `git branch -m main` then commit `m0: blueprint docs` — **only after the user approves the commit.** Tag none.

---

## M1 — Foundation + database + health endpoint

- **Objective:** runnable skeleton with DB, migrations, config, logging, health, test runner.
- **Create/modify:**
  - Tooling: `package.json` (allowlisted deps, exact versions, scripts), `tsconfig.json` (strict), `next.config.ts` (`serverExternalPackages: ['better-sqlite3']`), ESLint config, `vitest.config.ts`, Tailwind/PostCSS config, `.gitignore` (`.env.local`, `data/`, `backups/`, `node_modules/`, `.next/`), `.env.example` (placeholders only).
  - `src/server/config.ts` (zod env; fail fast on bad `SESSION_SECRET`/`DATABASE_PATH`; missing `ANTHROPIC_API_KEY` is allowed), `src/server/logger.ts`.
  - `src/server/db/{connection.ts,migrate.ts}` + `migrations/001_init.sql` (full schema from `ARCHITECTURE` §5, all CHECK/UNIQUE constraints).
  - `src/server/http/{envelope.ts,withRequestId.ts}`; `src/app/api/health/route.ts`; placeholder `src/app/{layout,page}.tsx`.
  - `tests/db.test.ts`, `tests/config.test.ts`.
- **Acceptance:** AC-090, AC-091, AC-094, AC-085 (ignore rules), AC-099 (envelope shape for health).
- **Verify:** `npm install` · `npm run check` · `npm run build` · `npm run dev` then `curl localhost:3000/api/health` → `{ok:true,data:{db:"ok",llm:"missing"|"configured"}}` · `git check-ignore .env.local data/x.db`.
- **Not yet:** any UI beyond placeholder, auth, seed data, domain logic, voice/LLM code, extra deps. If `better-sqlite3` won't install, spend ≤ 15 min then switch to `node:sqlite`/libsql behind `db/connection.ts` and log an ADR.
- **Expected completion state:** `npm run dev` serves a page and a working health endpoint; migrations idempotent; constraints enforced by tests.
- **Git checkpoint:** commit `m1: foundation` · no tag.

---

## M2 — Inventory ledger + products + deterministic business logic

- **Objective:** all inventory truth and arithmetic, framework-free and test-proven — **before any UI or AI exists**.
- **Create/modify:**
  - `src/server/domain/units/` — universal units, canonical unit type, `toBase(product, qty, unit)`, dimension checks, `formatStock`, non-representable rejection.
  - `src/server/domain/inventory/InventoryService.ts` — `createProduct`, `updateProduct`, `addPackUnit`, `applyChanges(StockChange[])` (add/remove/set; single SQLite transaction; re-checks non-negative), `adjust` (manual), `undo(txnId)` (reversal), `getStock`.
  - `src/server/domain/insights/` — velocity, days-left, status (`OUT/LOW/OK` + reason), reorder suggestion incl. an **explanation object** with every input used.
  - `src/server/domain/policy.ts` — constants (window 14 d, lead 2, safety 2, cover 7, ≥ 3 sales).
  - `src/server/db/repositories/{products,transactions,units,aliases,voiceEvents}.ts` (aliases/voiceEvents are thin CRUD; unused until M4/M5).
  - `tests/helpers/testDb.ts` (in-memory DB + factories), `tests/domain/*.test.ts` incl. a seeded-PRNG randomised ledger-invariant test (200 ops).
- **Acceptance:** AC-001 (domain level), 006, 007, 008, 009, 030, 031, 032, 035, 036, 037, 060, 061, 063, 064, 092, 093, 094.
- **Verify:** `npm run check` (all domain tests green); invariant test passes for ≥ 3 different PRNG seeds; `git grep -nE "voice|anthropic|next/" src/server/domain` returns nothing.
- **Not yet:** HTTP routes, auth, seed script, UI, lexicons, resolver, planner, any LLM/voice code, aliases logic.
- **Expected completion state:** "add 5 bags Rice → 23 bags, ledger row written, persisted; undo restores; units exact; insights match hand-computed cases" — all proven by tests alone.
- **Git checkpoint:** commit `m2: domain core` · tag `m2-ledger-proven` (**first implementation milestone**).

---

## M3 — Dashboard + product management + transactions + undo

Two slices, each with its own commit.

**Slice 3a — Seed, auth, APIs**
- **Create/modify:** `scripts/seed.ts` (shop "Lakshmi Kirana Store", ~15 products with en/hi/te aliases and pack units, 30 days of seeded-PRNG synthetic sales; ≥ 3 LOW items for different reasons; Sugar `bag` left undefined; Eggs in dozens; labelled synthetic); `src/server/auth/*` (scrypt PIN, jose session); `src/server/http/{withAuth,rateLimit}.ts` (login limit 5/min); routes: `auth/{login,logout,me}`, `dashboard`, `products` (list/create/get/patch), `products/:id/{units,aliases,adjust}`, `transactions` (+ `:id/undo`), `insights/reorder`; `tests/api/*.test.ts`.
- **Acceptance:** AC-002 (API), 014, 065, 066, 080, 081, 082, 083, 084, 086, 099, 110, 060/061 (via API).
- **Verify:** `npm run seed && npm run check` · curl login → `/api/dashboard` shows real computed statuses · seed twice → identical JSON (excluding timestamps) · unauthenticated call → 401.
- **Checkpoint:** commit `m3a: seed auth apis`.

**Slice 3b — UI (no voice)**
- **Create/modify:** `src/app/(auth)/login`, `src/app/(app)/{page,product/[id],history}`, `src/components/{PageShell,StockRow,AttentionCard,ActivityList,Sparkline,StatusPill,BottomDock,ProductForm}`, `src/client/{api,useDashboard}.ts` (SWR), Tailwind tokens per `UX_SPEC` §3. Mic button rendered but disabled. Product detail: ± / set-exact adjust, history with Undo, pack-size list with "+ Add pack size", threshold, one-line status reason ("Low · ~2 days left"). Create-product form (name + base unit + display unit). Empty/loading/error states.
- **Acceptance:** AC-008 (UI), 014 (UI), 100, 101, 102, 104, 106 (history part), 107 (status not colour-only), 062 (one-line reason only).
- **Verify:** `npm run check && npm run build`; manual at 360×800 and 1280 (screenshots via `claude-in-chrome` skill if available, else human); create a product, add pack size, adjust, undo — dashboard updates without reload.
- **Checkpoint:** commit `m3b: dashboard ui` · tag `m3-manual-app`.

- **Not yet (whole M3):** voice/LLM/STT, Interpretation Card, templates/i18n, aliases *logic* (data is seeded only), Q&A, "Why?" full explainer, reorder page, audit viewer, dark mode, charts library.
- **Expected completion state:** a fully **manual** inventory app: login → glanceable dashboard with real attention items → product management → adjust/undo, phone-friendly. Useful and demoable as a baseline even without AI.

---

## M4 — Voice pipeline + interpretation card + confirmation flow → **first demoable vertical slice**

**M4 is the first milestone that touches voice or the LLM.** Two slices.

**Slice 4a — Backend pipeline (tested with `FakeLlmClient`)**
- **Create/modify:**
  - `src/shared/interpretation.ts` (zod: `RawInterpretation`, `ValidatedPlan`, issue/blocker codes, card model).
  - `src/server/voice/normalize.ts`, `numbers.ts` (digits + English number words + decimals; hi/te words come in M5), `lexicon/en.ts` (unit synonyms, verbs).
  - `src/server/voice/resolver.ts` (product: exact alias → normalised fuzzy; unit canonicalisation; `toBase` via domain; LLM `catalog_id` only as tie-break hint).
  - `src/server/voice/planner.ts` — tiers T0–T3; blockers `op_unclear, product_ambiguous, product_unknown, unit_missing, unit_undefined (message points to product detail; teach flow is M5), unit_incompatible, exceeds_stock, quantity_missing, not_representable, unintelligible`; T2 triggers `set`, quantity outlier, numeric mismatch (digits/English words), fuzzy product; before→after preview from live DB; converts a plan into domain `StockChange[]` (adapter lives here, domain unaware).
  - `src/server/voice/llm/{client.ts,anthropic.ts,prompt.ts,tool-schema.ts,fake.ts}` (forced tool `emit_interpretation`, temp 0, 6 s timeout; **invoke the `claude-api` skill before writing this**).
  - `src/server/voice/pipeline.ts` (stages 1–9, persists `voice_events`, timeout/invalid-output → status `failed` with a plain error; **no fallback parser yet**), `voice/answer.ts` (`stock_of` only), `voice/templates/en.ts` (card lines, questions, results; keyed for later i18n).
  - Routes: `api/voice/interpret`, `api/voice/[id]/confirm` (patch re-validation, idempotent, calls `InventoryService.applyChanges` **only here**), `api/voice/[id]/cancel`; per-user LLM call cap (30/min).
  - `evals/utterances.jsonl` v0 (~20 rows) and a tiny `scripts/try-utterance.ts` for manual checks.
  - `tests/voice/*.test.ts`, `tests/api/voice.test.ts`.
- **Acceptance:** AC-001 (voice path), 002, 003, 007, 010, 011, 012, 013, 016, 017, 018, 020, 021, 022, 023, 024, 025 (digits/English), 026, 027, 028, 029, 086, 092, 095, 040 (English via LLM, manual/E spot-check).
- **Verify:** `npm run check` · integration test proves interpret ×N leaves DB unchanged (AC-011) · confirm twice applies once · forged delta ignored · `git grep -n "InventoryService" src/server/voice` shows only the confirm route/adapter call site · **with real key** `npx tsx scripts/try-utterance.ts "Rice five bags vachindi"` and 14 more (hi/te/mixed) → record raw outcomes in `PROGRESS.md` (early quality signal before M5's eval).
- **Checkpoint:** commit `m4a: voice pipeline backend`.

**Slice 4b — Voice UI and confirmation flow**
- **Create/modify:** `src/client/{useSpeechRecognition,useVoiceSession}.ts`, `src/components/voice/{VoiceSheet,ListeningView,TypedInput,InterpretationCard,QuestionCard,AnswerCard,ResultToast,ChipPicker}.tsx`, enable mic in `BottomDock`, language chip (sets STT locale), "Voice understanding unavailable — type or use manual adjust" banner, error states (mic denied / unsupported / no-speech). Card chips send **patches**; UI never computes stock.
- **Acceptance:** AC-010 (UI), 019, 023 (UI), 097, 100 (mic reachable), 103, 105, 106 (Done-state undo), 075 (chip corrections need no typing), 108 (measure).
- **Verify:** `npm run check && npm run build`; on Chrome desktop and the Android phone via tunnel: speak/type "Rice five bags vachindi" → live transcript → card → Confirm → number updates → "Done. Rice stock is now N bags." → Undo; "Rice 5 bags" → question, no change; "Dal 5 kilo aaye" → which dal?; "Toor dal ayipoyindi" → amber Set-to-0 card; remove API key → clear error + typed/manual path still usable.
- **Checkpoint:** commit `m4b: voice ui` · tag **`m4-vertical-slice`** · record a 30 s screen capture (backup video seed, H7).
- **Not yet (whole M4):** hi/te lexicons and templates, language ID, fallback parser/Basic mode, alias learning, teach-once units, create product, queries other than `stock_of`, reorder/insight answers, voice-log viewer, demo chips, TTS, server STT, streaming, auto-execute.
- **Expected completion state:** the P0 core loop works end-to-end on a phone: **speak/type → interpretation card → confirm → DB → dashboard → reply**, with tiers, blockers, undo and audit rows; Hindi/Telugu *understanding* works through the LLM even though replies are English and hi/te-specific safeguards arrive in M5.

---

## M5 — Multilingual intelligence + aliases + fallback parser

- **Objective:** make D2 (code-switch + cross-check), D3 (shop memory) and D5 (degradation) real, and **measure** AI quality.
- **Create/modify:**
  - `voice/lexicon/{hi,te}.ts` (+ extend `en.ts`), extended `numbers.ts` (hi/te number words, half/aadha/ardha), `voice/language.ts` (script + lexicon language ID), `voice/templates/{hi,te}.ts` and dominant-language reply selection (tie → shop default; unknown → English).
  - `voice/fallback-parser.ts` (single/multi-item `[product][number][unit][verb]`, yes/no/cancel/undo, `stock_of`); pipeline uses it when the LLM is missing/timeouts/invalid → `interpreter='fallback'`; **Basic mode** banner in UI.
  - Alias learning: patch of product chip → `learned` alias write (conflict-safe) on confirm; `use_count` increments; resolver prefers learned aliases (score 1.0).
  - Teach-once units: `unit_undefined` → `unit_size` question with numeric chips → `product_units(source='taught')` → plan continues.
  - `create_product` action (T2; unknown product on `add` → "Create 'X'?" with base-unit chips → product + opening stock in one transaction via `InventoryService`).
  - UI: numeric-chip QuestionCard, Create card, Basic-mode banner, read-only "Names I understand"/Units on product detail.
  - `evals/run.ts` + `npm run eval:voice`; `evals/utterances.jsonl` v1 (≥ 60 rows: en ≥ 12, hi ≥ 15, te ≥ 15, mixed ≥ 15, unsafe ≥ 10).
  - Tests for all of the above (`tests/voice/*`, `tests/api/voice-memory.test.ts`).
- **Acceptance:** AC-005, 015, 033, 034, 040–049, 070–076, 048, 096, 021 (learned-alias effect), 025 (hi/te numbers), 097.
- **Verify:** `npm run check` · offline suite runs every eval row through the fallback parser with **unsafe-write = 0** · **with real key** `npm run eval:voice` → paste table into `PROGRESS.md` (gates in AC-049; if short, fix prompt/lexicon in a timeboxed loop, try `LLM_MODEL=claude-sonnet-5`, else document the gap) · manual: teach Sugar bag = 50 kg → card "2 bags (100 kg)"; fix a mis-heard product once, repeat phrase → no question · unset key → Basic mode banner and a simple command still works.
- **Not yet:** LLM-written free-text answers, alias/unit *editing* UI, more languages, server STT, TTS, any query beyond `stock_of`.
- **Expected completion state:** Telugu/Hindi/English/mixed input understood with independent number cross-check; replies in the user's language; the app learns pack sizes and vocabulary; Basic mode works; eval numbers recorded.
- **Git checkpoint:** commits per slice (`m5a: lexicons+fallback+eval`, `m5b: shop memory`) · tag `m5-multilingual`.

---

## M6 — Reorder intelligence + explainability + audit trail

- **Objective:** D4 end-to-end (questions → explained reorder) and full traceability of every voice interaction.
- **Create/modify:**
  - `voice/answer.ts`: `low_stock`, `reorder_list`, `days_left`, `sales_summary` (today/yesterday/week, `Asia/Kolkata`), `history`; templates en/hi/te for each (facts only, from `domain/insights` and repositories).
  - `AnswerCard` variants; `src/app/(app)/reorder/page.tsx` (rows: product · suggested qty in packs · one-line reason; tap → expanded math from the explanation object); "Why?" on attention cards and product detail; navigation from answers to reorder/product pages.
  - Audit trail: `GET /api/voice/events` (paged) + `src/app/(app)/log/page.tsx` (transcript, engine, language, interpreter, tier, status, latency, plan summary, link to resulting transaction); source badges (🎤 ✋ ↩) in Activity linking to the event.
  - Extra eval rows for queries; tests for each query against mutated DB rows.
- **Acceptance:** AC-002 (all languages), 004, 050, 051, 052, 053, 054, 055, 056, 062, 063, 064, 065, 066, 095 (viewable).
- **Verify:** `npm run check && npm run build` · voice/typed "what's low", "Kya order karna hai", "Toor dal kitne din chalega", "Ivvala entha ammanu" answer from live data; add stock via voice → re-ask → answer changes; hand-check one suggestion against the formula; log page shows the last interactions incl. blocked/cancelled ones.
- **Not yet:** WhatsApp share (P1), LLM-worded answers (P1), charts, dead-stock insight (P2), log export.
- **Expected completion state:** the "AI insights" claim is provable: every figure is computed from the ledger and shows its inputs; every voice interaction is auditable.
- **Git checkpoint:** commit `m6: questions, reorder explainability, audit` · tag `m6-insights`.

---

## M7 — Demo hardening + testing + deployment + demo mode → **P0 complete**

- **Objective:** make P0 reliable, rehearsed and recoverable.
- **Create/modify:** login/LLM rate-limit review; error boundaries and plain-language errors; empty/edge states from `UX_SPEC` §6; a11y pass (contrast, labels, focus); `scripts/{backup,restore}.ts`; **demo mode** (`DEMO_MODE=1`/`?demo=1`): "Try saying…" phrase chips that submit text through the real pipeline (recorded as `stt_engine='typed'`), demo login button, `npm run seed` reset (script + optional protected reset endpoint); `README.md` (run, seed, env, tunnel, optional deploy); optional deployment to a persistent-volume host; `docs/DEMO_SCRIPT.md`; secret scan (`git grep -nE "sk-ant|ANTHROPIC_API_KEY=.+"`); latency measurement (10 live runs).
- **Acceptance:** AC-082, 085, 090, 098, 099, 104, 107, 108, 109, 111, 112, 114 and every remaining P0 AC not previously verified (see coverage map in `ACCEPTANCE_CRITERIA.md`).
- **Verify:** `npm run check && npm run build && npm start` · failure drills: kill key (Basic mode), block mic (typed), airplane mode, double-tap Confirm, undo-would-go-negative, wrong PIN ×6 · `npm run backup && npm run restore` round-trip (counts and stock sums equal) · fresh-clone README run ≤ 10 min · full demo storyline (`PRODUCT_SPEC` §8) twice in a row on the phone over the tunnel.
- **Not yet / never in P0:** any P1 item, refactors for style, new features. **P0 gate:** any failing P0 AC is fixed before anything else.
- **Expected completion state:** submission-grade prototype: seeded, deterministic reset, documented, backed-up, with a working typed/chip path if the mic fails.
- **Git checkpoint:** commit `m7: hardening + demo mode` · tag **`m7-p0-complete`**; after the last rehearsal tag `demo-freeze` and stop feature work.

---

## After M7

- **P1 (only after `m7-p0-complete`, strict order, stop anytime):** WhatsApp share of reorder list → full UI localisation en/hi/te → TTS → server-side STT → voice "yes" confirm → Playwright smoke → alias/unit editing UI, archive, mixed display, CSV → more languages. *If S1 shows Web Speech unusable for Telugu/Hindi, move server-side STT to right after M4 instead.* One item per commit, each must keep P0 ACs green.
- **Submission assets (parallel track from M4 on):** backup demo video (record after M4; re-record after M7), final demo video (2–3 min: problem → mixed-language flow → safety moment → question/insight → close), solution presentation (pipeline + safety tiers + measured eval numbers), pitch deck.
  - **Deck outline (10 slides):** Title/positioning · Problem (challenge-given claims only) · Users & trust insight · Solution demo · How it works (pipeline + safety) · Differentiators D1–D5 · Measured results (eval table) · Market & business model (**cite sources or omit numbers**) · Roadmap (P1/P2, true offline, more languages) · Team/ask.

---

## Session protocol (every session)
1. Read `CLAUDE.md`, `docs/PROGRESS.md`, then only the current milestone here and the spec sections it cites.
2. `git status`, `git log --oneline -5`, `npm run check` for a baseline.
3. Work one slice at a time; commit at slice boundaries when the user permits; keep the tree green.
4. Update `docs/PROGRESS.md` (status, verified-how, next step, blockers, decisions).
5. If the milestone can't finish, leave a green tree and a precise resume note.

## Cut list when time is short (cut from the top; never cut the "never" list)

1. **All P1** (already excluded).
2. **M7:** optional cloud deployment (tunnel only), long README, a11y polish beyond contrast/labels.
3. **M6:** voice-log viewer page (keep DB logging and source badges), `sales_summary` and `history` voice queries. Keep `low_stock`, `reorder_list`, "Why?".
4. **M5:** reduce eval set to ≥ 30 rows; drop `create_product` by voice (manual create exists from M3); Hindi/Telugu reply templates → keep English replies (understanding still works via the LLM — weakens D2's "reply in your language" only); fallback parser limited to English + digits.
5. **M3:** sparkline, search, product history section (keep adjust + Undo in Activity), create-product form.
6. **M4:** `AnswerCard` extras, language chip (default te-IN/hi-IN via settings), multi-item UI polish (backend supports it).

**Never cut:** confirm gate and tiers T0–T3, undo, ledger integrity/single writer, planner blockers, number cross-check, `unsafe-write = 0` eval gate, insights computed from real data, Basic-mode banner + typed input.

**Compression if only ~5–6 sessions exist:** merge M1+M2 (1 session) → M3 (1.5) → M4 (2) → M5-lite (fallback parser + te/hi lexicon + teach-once; 1) → M7-lite (README, backup, demo script; 0.5).

## Legacy map (older docs still say "Phase N" and old tag names)

| Old reference | New home |
|---|---|
| Phase 0 | M0 |
| Phase 1 | M1 |
| Phase 2 | M2 (tag `m2-ledger-proven`) |
| Phase 3 (seed/auth/APIs) + Phase 4 (dashboard UI) | M3 (slices 3a, 3b) |
| Phase 5 (deterministic voice) | split: resolver/planner/English numbers → M4a; hi/te lexicons, language ID, fallback parser, hi/te templates → M5 |
| Phase 6 (LLM, pipeline, endpoints) | M4a (eval harness → M5) |
| Phase 7 (voice UI + vertical slice), tag `m2-vertical-slice` | M4b, tag `m4-vertical-slice` |
| Phase 8 (questions & insights) | `stock_of` in M4a; the rest in M6 |
| Phase 9 (shop memory) | M5 |
| Phase 10 (hardening), tag `m3-p0-complete` | M7, tag `m7-p0-complete` |
| Phase 11 (P1) | After M7 |
| Phase 12 (assets) | Submission-assets track |
| "S1 spike" | Human task H2, before M4 ends |
