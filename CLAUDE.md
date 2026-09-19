# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Build **Stockbol (working name) — an AI Voice Inventory Copilot for Indian small businesses**, for a hackathon on *"Voice-Based Inventory Management for Small Businesses"*. A shopkeeper speaks in Telugu/Hindi/English (or a mix); the system shows what it understood, confirms, updates real inventory, and proactively surfaces reorder insights from the shop's actual transaction history.

Core loop (every feature must serve it): **speak → understand → show what was understood → confirm when necessary → execute → update inventory → explain result → surface insight.**

Strategy: **fewer features, deeper implementation, reliable demo, strong differentiation.** We are not building a CRUD app with a microphone button.

## Current state

M0 (blueprint docs) is written: only documentation exists. No application code yet. Work is organised as milestones **M0–M7** (see `docs/IMPLEMENTATION_PLAN.md`; its "Legacy map" translates older "Phase N" mentions in other docs). **Read `docs/PROGRESS.md` first** for the current milestone and exact resume point, then that milestone in the plan. The LLM/voice layer is introduced only in M4.

## Document map (read before coding — only what the current phase needs)

| Need | Read |
|---|---|
| What/for whom/priorities (P0/P1/P2), demo storyline | `docs/PRODUCT_SPEC.md` |
| Stack, layout, data model, APIs, pipeline, units, insights formulas | `docs/ARCHITECTURE.md` |
| Voice/NLP contracts, tiers, resolution, prompts, eval | `docs/AI_VOICE_SPEC.md` |
| Screens, components, copy, states | `docs/UX_SPEC.md` |
| Why we're different (don't dilute) | `docs/DIFFERENTIATION.md` |
| Phases, verification commands, checkpoints | `docs/IMPLEMENTATION_PLAN.md` |
| Testable requirements (AC-xxx) | `docs/ACCEPTANCE_CRITERIA.md` |
| Status, human tasks, eval log | `docs/PROGRESS.md` |
| Why decisions were made / open questions | `docs/DECISIONS.md` |

If code and docs disagree: stop, decide which is right, fix the other, and log it in `docs/DECISIONS.md` for anything non-trivial.

## Stack (decided — see ARCHITECTURE §2 before proposing changes)

Next.js (App Router) + React + TypeScript + Tailwind · SQLite via `better-sqlite3` with hand-written SQL migrations (no ORM) · zod · SWR · jose (session JWT) + `node:crypto` scrypt (PIN) · Claude via `@anthropic-ai/sdk` (forced tool call → structured JSON; default `claude-haiku-4-5-20251001`, env `LLM_MODEL`) · Browser Web Speech API for STT (typed input always available) · Vitest. npm. Node ≥ 22.

Commands (defined in M1; if `package.json` doesn't exist yet, the app hasn't been scaffolded):
`npm run dev | build | start | typecheck | lint | test | check` · `npm test -- <path-or-pattern>` runs a single test file · `npm run seed | backup | restore` · `npm run eval:voice` (real LLM, needs `ANTHROPIC_API_KEY`). `check` = typecheck + lint + test and must be green before every commit.

## Architecture principles

- **Modular monolith.** No microservices, queues, or extra infra.
- **Layering:** `app → server/http → (voice | domain) → db`. `domain/` is pure business logic (no HTTP, no LLM SDK). `voice/` turns language into a *plan* and **never writes stock**. `shared/` holds zod contracts. SQL lives only in `server/db/`.
- **Single writer:** only `domain/inventory/InventoryService` mutates `products.stock_base` or inserts `inventory_transactions`, inside one SQLite transaction. The ledger is append-only; undo = compensating reversal. Invariant: `stock_base == Σ delta_base` and `>= 0`.
- **Integer base units** (`piece`/`g`/`ml`). Universal conversions live in code (dozen=12 piece, kg=1000 g, litre=1000 ml…); **pack units (bag, box, carton, packet…) have no default size** — they exist only when configured or taught by the business. Never assume.
- Thin route handlers: parse (zod) → call service → response envelope `{ok, data|error}`.

## AI safety & reliability principles (non-negotiable)

1. **The LLM proposes; deterministic code disposes.** The LLM only outputs a `RawInterpretation` (language understanding). It has no write tools and never sees the DB handle. Output is zod-validated, catalog-resolved by deterministic code, and number-cross-checked.
2. **No silent writes.** Every voice write requires a confirm call on a server-stored `ValidatedPlan`. Ambiguity → clarification (tier T3), never a guess. The client sends `eventId` + field patches, never deltas; the server re-validates everything.
3. **No fake AI.** No hard-coded/canned responses that imitate intelligence. Every figure the user sees comes from the DB or an explicit, tested formula over DB rows. Demo chips submit text into the *real* pipeline.
4. **Graceful degradation, visibly:** LLM down → deterministic fallback parser + "Basic mode" banner; mic/STT down → typed input. Never claim offline support we don't have.
5. **Transcripts and catalog names are untrusted data** (prompt-injection safe: single output tool, schema validation, confirm gate).
6. Secrets only via env (`.env.local`, gitignored); `.env.example` committed with placeholders; never `NEXT_PUBLIC_` for secrets; never log keys/PINs; never commit keys. If a key appears in a diff, stop and remove it.

## Voice / NLP principles

- Pipeline stages and contracts are in `docs/AI_VOICE_SPEC.md` §2–3; keep stage boundaries and types — don't collapse them into one function.
- Numbers are the riskiest tokens → independent deterministic extraction + cross-check; STT alternatives are passed along.
- Product resolution is deterministic (alias exact → fuzzy/skeleton match); the LLM's `catalog_id` is only a hint.
- Reply in the user's dominant language (en/hi/te) with **deterministic templates**; unknown language → English. Product names are shown as stored.
- Lexicons/templates in Telugu/Hindi need native-speaker review; mark unreviewed strings in `PROGRESS.md`, don't silently "improve" them.
- Every bug found in voice behaviour becomes a row in `evals/utterances.jsonl` and/or a unit test. The **unsafe-write count must stay 0**.
- Before writing/modifying the Anthropic client or prompt, invoke the `claude-api` skill.

## UX principles

Shopkeeper-first, mobile-first (360×800), glanceable dashboard, one-tap flows, cheap correction via chips, plain words in the user's language, status never colour-only, touch targets ≥ 48 px, designed empty/error/degraded states. Follow `docs/UX_SPEC.md` tokens and copy rules; don't invent new visual styles per screen.

## Coding standards

- TypeScript `strict`; no `any` without a comment explaining why; no unused exports left behind.
- Validate at boundaries with zod (API in/out, LLM output, env). Domain code trusts validated types.
- Domain errors: throw typed `DomainError(code, message)`; map to HTTP in `server/http`. Never swallow errors; never return partial success from multi-step writes.
- Small modules, explicit names, no premature abstraction. Match existing style; comments explain *why*, not *what*.
- Money in paise (integers) if used; quantities as integers in base units; format only at the edge.
- All timestamps UTC ISO strings; business-day windows use `Asia/Kolkata`.
- Match the surrounding code's density/naming; don't reformat unrelated code.

## Testing requirements

- Every domain function and every planner/resolver rule has unit tests; every AC in scope for the phase has a passing test or a documented manual check.
- Integration tests call route handlers with an in-memory SQLite DB and `FakeLlmClient` (no network in `npm test`).
- Invariant tests (ledger sum, non-negative stock) stay green.
- Real-LLM quality is measured only by `npm run eval:voice`; record results in `docs/PROGRESS.md`.
- **Verify real behaviour before claiming done:** run the command, look at the output, hit the endpoint, use the UI at 360 px. "Should work" is not done. If something can't be verified (e.g. mic on a real phone), say so explicitly and list it as a human task.

## Git & checkpoints

- Default/base branch is **`main`** (local unborn branch may be `master` — see ADR-018).
- Commit at the end of each milestone slice with a message like `m4a: voice pipeline backend`; keep the tree green (`npm run check`). Tags per the plan: `m2-ledger-proven`, `m3-manual-app`, `m4-vertical-slice`, `m5-multilingual`, `m6-insights`, `m7-p0-complete`, `demo-freeze`.
- **Only commit/push when the user asks or the plan's checkpoint says so and the user has allowed it in this session.** Never force-push, never rewrite published history, never `--no-verify`.
- Commit messages end with the co-author trailer given by the harness attribution instructions.

## Dependency rules

- Allowed runtime: `next react react-dom better-sqlite3 zod jose @anthropic-ai/sdk swr lucide-react tailwindcss` (+ Tailwind's peer tooling). Allowed dev: `typescript vitest eslint @types/* tsx` (+ `@playwright/test` in P1).
- Anything else needs a written reason in `docs/DECISIONS.md` **before** installing. Pin exact versions. No UI kits, chart libraries, state libraries, ORMs, animation libraries, or i18n frameworks in P0.
- Don't run `npm install` in a phase whose plan doesn't call for it.

## Scope control

- **Priority order: P0 → P1 → P2.** P1 work starts only after the P0 gate (`m7-p0-complete`) and in the order listed under "After M7" in the plan. P2 and anything under "Non-goals"/"Considered and not chosen" is refused.
- Do only what the current milestone lists; each has a **"Not yet"** list — respect it. If you find a needed change outside the milestone, note it in `PROGRESS.md` instead of doing it (unless it blocks the milestone). Inventory logic in `domain/` never imports from `voice/`; the LLM never modifies inventory.
- **Do not rebuild working, verified features.** Extend or fix them; refactor only when required by the current phase or a failing test.
- A feature that only "sounds impressive" and doesn't strengthen the core loop or a D1–D5 differentiator doesn't get built.
- Don't add configuration, abstractions, or "future-proofing" beyond what the phase needs.

## Definition of done (per task/phase)

1. Behaviour matches the relevant spec sections and the listed ACs.
2. `npm run check` (and `npm run build` for UI/route changes) green — output actually observed.
3. Tests added for new logic; failing cases documented (e.g. eval rows).
4. UI changes checked at 360×800 (screenshot or explicit manual note).
5. `docs/PROGRESS.md` updated: status, what was verified and how, next step, blockers. Docs updated if behaviour/decisions changed.
6. Checkpoint commit made (when permitted); no secrets, no stray files (`data/`, `.env.local`, `backups/` are ignored).

## Context hygiene (limited token budget)

Start each session: read `CLAUDE.md` → `docs/PROGRESS.md` → the phase in `IMPLEMENTATION_PLAN.md` → only the referenced spec sections. Run `git status`, `git log --oneline -5`, `npm run check` for a baseline. Prefer targeted reads/greps over broad exploration; don't paste large files into chat; end sessions with a green tree and a precise resume note in `PROGRESS.md`.
