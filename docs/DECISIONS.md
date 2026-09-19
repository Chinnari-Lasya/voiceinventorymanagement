# DECISIONS

Lightweight ADR log. Append new entries at the bottom (never rewrite history — supersede instead). Stack options and trade-offs live in `ARCHITECTURE.md` §2; this file records *why we decided* and *what would change our mind*.

Format: **ADR-NNN Title** — Status (Accepted / Superseded by / Open) · Decision · Why · Revisit trigger.

---

**ADR-001 Modular monolith on Next.js + TypeScript** — Accepted
Decision: single Next.js app serving UI + REST route handlers; business logic in framework-free `src/server/{domain,voice}`.
Why: one language/process/deploy; fastest for Claude Code to build and verify; the domain/voice code is portable if the framework becomes a problem.
Revisit if: dev server/build friction costs > 1 h, or better-sqlite3 + Next bundling misbehaves → move to Vite + Hono, reuse `src/server/*`.

**ADR-002 SQLite (better-sqlite3), hand-written SQL migrations, no ORM** — Accepted
Why: zero infrastructure; synchronous transactions make atomic stock updates simple; one file to back up; repository boundary keeps SQL out of the rest of the code.
Revisit if: native install fails on Windows (→ `node:sqlite` or libsql, ≤ 15 min timebox) or a hosted multi-instance deploy is needed (→ Postgres adapter).

**ADR-003 Integer base units (piece / g / ml)** — Accepted
Why: exactness (no float drift), simple invariants (`stock == Σ delta`), and conversion is a single multiplication. Display units are a presentation choice, pack sizes are data.
Trade-off: very small/large fractions (e.g. 0.5 piece) are rejected as not representable — acceptable for retail.

**ADR-004 No default pack sizes; teach-once via conversation** — Accepted
Why: the brief says not to assume bag/carton sizes; wrong defaults corrupt stock silently. Asking once costs ~5 seconds and doubles as onboarding.
Revisit if: user testing shows the question is annoying → offer suggestions (25/50) as chips, still never auto-apply.

**ADR-005 Ledger is truth; `products.stock_base` is a cached column updated in the same transaction** — Accepted
Why: fast reads for dashboard; correctness guaranteed by the invariant test and single writer (`InventoryService`). Ledger is append-only; undo = compensating reversal.

**ADR-006 LLM = interpreter only; deterministic planner/validator/executor** — Accepted
Why: the brief's AI-safety rule. The LLM output is schema-validated, cross-checked (numbers), and re-resolved against the catalog; the client cannot post deltas; writes require confirm.

**ADR-007 Claude (Haiku 4.5 default) via forced tool-call JSON; provider behind `LlmClient`** — Accepted (model choice provisional)
Why: strong multilingual understanding, reliable structured output, low latency.
Open questions resolved by Phase-6 eval: Haiku 4.5 vs `claude-sonnet-5`; whether prompt caching applies. **Record the numbers here after Phase 6.**
Revisit if: Telugu/Hindi code-mix accuracy < gates → try Sonnet 5 → try Gemini adapter (P1).

**ADR-008 Browser Web Speech API as P0 STT; typed input always available; server STT is P1** — Accepted (validate via S1)
Why: zero setup, live captions, alternatives+confidence, good on Chrome-Android. Risks: Chrome-only, needs network + HTTPS, audio goes to the browser vendor, Indic accuracy unproven.
Revisit if: S1 shows unusable te-IN/hi-IN transcripts → move Phase 11 item 4 (server STT with Sarvam/Whisper; **verify current API/pricing first**) to immediately after Phase 7.

**ADR-009 Deterministic templates for all user-facing replies (en/hi/te)** — Accepted
Why: numbers can't be hallucinated; no latency; unit-testable. LLM verbalisation with a number guard is P1.
Requires: native-speaker review of Telugu/Hindi strings (human task).

**ADR-010 Confirmation on every voice write in the MVP (no auto-execute), risk tiers T0–T3** — Accepted
Why: trust is the product; the extra tap is cheap versus a silent wrong entry. Tier drives how careful the card is, not whether to confirm.
Revisit if: eval shows unsafe-write = 0 over a large set *and* users find the tap slow → consider T1 auto-apply with 10 s undo (post-hackathon).

**ADR-011 Removing more than current stock is blocked, not clamped** — Accepted
Why: silently clamping hides that the recorded stock was wrong. The user is offered "Set stock" (T2) to reconcile.

**ADR-012 Insights are formulas over the ledger with visible inputs** — Accepted
Constants (14-day window, lead 2 d, safety 2 d, cover 7 d, ≥ 3 sales) are defaults in `domain/policy.ts` and shop-overridable for lead/cover. Chosen for explainability; a forecasting model would be less trustworthy and unnecessary at this data volume.

**ADR-013 Demo data is synthetic, seeded deterministically, and labelled as such** — Accepted
Why: insights need history to be real-data-driven. We never present the synthetic data as customer data or market statistics.

**ADR-014 Auth: username + PIN, jose JWT cookie, scrypt via node:crypto; no signup in P0** — Accepted
Why: meets "basic authentication" with minimum surface; PIN suits shopkeepers. Signup/onboarding is P1.

**ADR-015 Hosting: local + HTTPS tunnel as primary demo path; persistent-volume Node host as secondary** — Accepted
Why: Web Speech/mic need a secure context; SQLite needs a persistent disk (so not Vercel/Netlify). Tunnel is fastest to set up and easiest to recover.

**ADR-016 True offline is out of scope; we document degraded modes instead** — Accepted
Why: local Whisper is heavy and weak for Telugu at small sizes; a partial offline story would risk the demo. We claim only what works (Basic mode, typed input).

**ADR-017 Language scope: English + Hindi + Telugu for P0** — Accepted
Why: depth beats breadth; these three cover the required "regional + mixed" demonstration; other languages ride on the same LLM path in P1. The team can review Telugu/Hindi strings (confirm in PROGRESS human tasks).
Revisit if: no native reviewer is available for one language → keep the LLM path but mark templates "unreviewed".

**ADR-018 Git branch naming** — Accepted
The remote/default branch is `main`; the local unborn branch is `master`. First commit should be made on `main` (`git branch -m main` before the first commit) so PRs target the right base.

**ADR-019 Process: docs are the memory** — Accepted
`CLAUDE.md` + `docs/PROGRESS.md` + `git log` must be enough to resume. Any deviation from the specs is recorded here first.

---

## Open questions (resolve by the named checkpoint)

| # | Question | Resolve at | Default if unresolved |
|---|---|---|---|
| Q1 | Does Web Speech te-IN/hi-IN give usable transcripts for code-mixed phrases on the demo phone? | S1 (Phase 1–2) | Proceed with Web Speech + typed; prioritise server STT |
| Q2 | Haiku 4.5 vs Sonnet 5 accuracy/latency on golden set | Phase 6 | Haiku 4.5 |
| Q3 | Who reviews Telugu/Hindi strings and lexicons? | Before Phase 5 ends | Mark templates "unreviewed" in PROGRESS |
| Q4 | Which host (if any) for the secondary deployment? | Phase 10 | Local + tunnel only |
| Q5 | Final product name (working name "Stockbol") | Phase 12 | Keep working name |
