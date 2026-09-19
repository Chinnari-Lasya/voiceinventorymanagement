# PROGRESS

**This file is the session-to-session memory. Update it after every meaningful piece of work.** Keep it short and factual: what is *verified working* vs *written but unverified* vs *not started*.

_Last updated: 2026-09-19 — M0 docs written (uncommitted, awaiting user approval); plan reorganised into milestones M0–M7; no application code exists yet._

## Current status

| M | Name | Status | Verified by | Commit/tag |
|---|---|---|---|---|
| M0 | Documentation + repository checkpoint | 🟡 docs written; **commit awaiting user approval** | files present, cross-referenced | — |
| M1 | Foundation + database + health | ⬜ not started | | |
| M2 | Ledger + products + deterministic logic | ⬜ | | `m2-ledger-proven` |
| M3 | Dashboard + product mgmt + txns + undo (3a API, 3b UI) | ⬜ | | `m3-manual-app` |
| M4 | Voice pipeline + card + confirm (4a backend, 4b UI) — **first demoable slice** | ⬜ | | `m4-vertical-slice` |
| M5 | Multilingual + aliases + fallback parser + eval | ⬜ | | `m5-multilingual` |
| M6 | Reorder intelligence + explainability + audit trail | ⬜ | | `m6-insights` |
| M7 | Demo hardening + deploy + demo mode → **P0 complete** | ⬜ | | `m7-p0-complete`, `demo-freeze` |
| — | P1 stretch (after M7) · Submission assets (parallel track) | ⬜ | | |

Legend: ⬜ not started · 🟡 in progress · ✅ done and verified · ⚠ blocked. Older docs say "Phase N": see the Legacy map at the bottom of `IMPLEMENTATION_PLAN.md`.

## Next step (resume here)

**M0 → M1.** First, with user approval: `git branch -m main` and commit the 10 docs (`m0: blueprint docs`) — see ADR-018. Then **M1 — Foundation**: read `docs/IMPLEMENTATION_PLAN.md` §M1, `docs/ARCHITECTURE.md` §2, §3, §5, §9.

## Environment facts (verified 2026-09-19)

- OS Windows 11; shell PowerShell/Git Bash. Node v22.20.0, npm 10.9.3, Python 3.14.6 (not needed), git 2.51.
- Repo had zero commits and an empty working tree at the start of Phase 0.
- No app dependencies installed yet.

## Human tasks (need a person, not Claude)

| # | Task | Owner | Needed by | Done |
|---|---|---|---|---|
| H1 | Obtain `ANTHROPIC_API_KEY`; put in `.env.local` (never commit) | team | Phase 6 | ☐ |
| H2 | **S1:** test Web Speech (Chrome-Android, te-IN / hi-IN / en-IN) with 10 phrases from AI_VOICE_SPEC §5; paste raw transcripts below | team | before Phase 6 end | ☐ |
| H3 | Native-speaker review of Telugu + Hindi lexicon entries and template strings | team | Phase 5–7 | ☐ |
| H4 | Talk to ≥ 1 real shop owner (even informally) and note 3 observations to validate PRODUCT_SPEC §3 assumptions | team | Phase 12 pitch | ☐ |
| H5 | Choose/setup tunnel (Cloudflare Tunnel or ngrok) and test on phone | team | Phase 7 | ☐ |
| H6 | Decide secondary hosting (optional) | team | Phase 10 | ☐ |
| H7 | Record backup demo video | team | Phase 12 (start after M2) | ☐ |

### S1 results (fill in)
_Phone/model, Chrome version, per-locale transcripts and notes:_ (none yet)

## Verified-working log

_(empty — add a line per verified capability with the command/date, e.g. "2026-09-20: `npm run check` green; AC-001 unit test passes")_

## Eval results log (from Phase 6)

| Date | Model | Intent % | Prod+qty+unit % (en/hi/te) | Unsafe writes | p50 / p95 ms | Fallback rate | Notes |
|---|---|---|---|---|---|---|---|

## Known issues / risks in flight

- Web Speech accuracy on Telugu/Hindi code-mix unproven (Q1).
- Templates/lexicons for Telugu/Hindi are unreviewed by a native speaker (Q3).

## Session log

_Newest first. Template:_
`YYYY-MM-DD · Phase N · what was done · what was verified (commands) · what's next · blockers`

- 2026-09-19 · Phase 0 · Created CLAUDE.md and docs/{PRODUCT_SPEC, ARCHITECTURE, AI_VOICE_SPEC, UX_SPEC, DIFFERENTIATION, IMPLEMENTATION_PLAN, ACCEPTANCE_CRITERIA, PROGRESS, DECISIONS}.md · verified: files exist, IDs/phases cross-referenced · next: Phase 1 · blockers: none
