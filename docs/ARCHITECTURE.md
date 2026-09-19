# ARCHITECTURE

Modular monolith. One Next.js (TypeScript) process serves UI and REST API; one SQLite file stores data; one server-side LLM call interprets language. No queues, no microservices, no Docker required for development.

## 1. Selection criteria (ranked)

Hackathon time-to-build · reliability · Claude Code efficiency (one language, popular tools, few moving parts) · local dev ease · deploy simplicity · voice + multilingual capability · demo polish · maintainability.

## 2. Stack decisions

| Layer | **Chosen** | Alternatives considered | Why chosen | Risks | Fallback |
|---|---|---|---|---|---|
| App framework | **Next.js (App Router) + React + TypeScript**, versions pinned at scaffold | Vite SPA + Fastify/Hono; SvelteKit; FastAPI + HTMX/React | One repo, one language, one process; route handlers give REST APIs; mobile-first UI in React is what Claude produces best. Node 22 already installed. | Framework churn (async request APIs, caching defaults); dev server slower than Vite. | Vite + Hono with the same `src/server/*` modules — domain/voice code is framework-free, so a swap touches only `src/app` and `src/server/http`. |
| Styling | **Tailwind CSS** + hand-written small components, lucide icons | shadcn/ui, MUI, Chakra | Fast, no runtime, consistent tokens; avoids heavy UI-kit debugging. | Class noise. | Plain CSS modules. |
| Client data | **SWR** (fetch + cache + `mutate`) | TanStack Query, Redux, RSC-only | Tiny; `mutate()` gives instant dashboard refresh after confirm. | — | `fetch` + `useState`. |
| Database | **SQLite** via **better-sqlite3** (sync, WAL mode) | Postgres (Neon/Supabase), Firebase, Turso/libsql, JSON file | Zero infra; ACID transactions; backup = one file / `.backup()`; synchronous API makes atomic inventory transactions trivial to reason about; portable demo. | Native module build on Windows (prebuilt binaries normally exist for Node LTS); ephemeral disks on serverless hosts. | `@libsql/client` (same SQL) or Node's built-in `node:sqlite`; all SQL is confined to `src/server/db/` so it can move to Postgres. |
| Data access | **Hand-written SQL migrations + small repository modules + zod** | Drizzle, Prisma, Kysely | Fewest dependencies/tooling steps; explicit transactions; no codegen/migration CLI to debug. | More boilerplate. | Drizzle over the same schema. |
| Validation | **zod** (shared schemas in `src/shared`) | valibot, io-ts | Ubiquitous; used for API DTOs *and* LLM output. | — | — |
| Auth | **Username + PIN**, `node:crypto` scrypt hash, **jose** signed JWT in httpOnly cookie | NextAuth/Auth.js, Clerk, Firebase Auth, magic links | Matches the "basic authentication" ask; shopkeeper-friendly PIN; no third-party account setup; no extra dependency for hashing. | Hand-rolled auth surface. | Auth.js credentials provider. |
| Speech-to-text (P0) | **Browser Web Speech API** (`SpeechRecognition`, `lang` = `te-IN` / `hi-IN` / `en-IN`), with alternatives + confidence, **plus typed input** always available | Sarvam AI STT (Indic, code-mix aware — verify current API), OpenAI Whisper/`gpt-4o-transcribe`, Google Cloud STT, in-browser Whisper (transformers.js), Deepgram | Zero key/cost/setup; live interim captions (great demo); streams; Chrome-Android is the realistic target device. LLM downstream normalises scripts and code-mixing. | Chrome-only in practice; requires internet + HTTPS (secure context); accuracy on Telugu/Hindi code-mix unproven → **spike S1**; audio goes to browser vendor. | **P1: server-side STT adapter** (MediaRecorder → `/api/voice/transcribe` → Sarvam or Whisper) behind the same `Transcript` interface. Typed input is the always-on fallback. |
| Interpretation (NLU) | **Claude via `@anthropic-ai/sdk`, forced tool call producing structured JSON**, default **Haiku 4.5** (`claude-haiku-4-5-20251001`), model set by `LLM_MODEL` env; escalate to `claude-sonnet-5` only if eval shows Haiku insufficient | Gemini Flash, OpenAI mini models, fine-tuned/local model, pure rules | Strong multilingual, reliable structured output via tool use, low latency at Haiku tier. Rules alone cannot cover open code-mixed phrasing. | Unverified Telugu/Hindi code-mix quality → **spike S1** measures it; network dependency; cost is negligible at demo volume. | (a) deterministic fallback parser (always built); (b) `LlmClient` interface allows a Gemini/OpenAI adapter (P1). |
| Response generation | **Deterministic i18n templates** (en/hi/te) fed with DB facts | LLM free-text answers | Numbers can't be hallucinated; no latency; testable. | Less "chatty". | P1: LLM verbalisation with a *number guard* (every digit in the reply must exist in the fact payload, else fall back to template). |
| TTS | **P1**: browser `speechSynthesis`, only if a voice for the locale exists | Cloud TTS (Google/Azure/Sarvam) | Free, offline-capable, no key. | Telugu voice availability varies by device. | Skip TTS. |
| Tests | **Vitest** (unit + integration with in-memory SQLite, LLM mocked); **eval harness** for golden utterances against real LLM; **Playwright** smoke (P1) | Jest | Fast, TS-native, no config. | Mic can't be automated → E2E uses typed input. | — |
| Package manager | **npm** | pnpm, yarn | Already installed (10.9); no extra setup. | — | — |
| Hosting | **Local-first demo + HTTPS tunnel** (Cloudflare Tunnel/ngrok) for phone; **secondary**: single Node service on a host with a persistent volume (Fly.io/Railway/Render) | Vercel/Netlify (no persistent disk for SQLite) | Mic and Web Speech need a *secure context*: `localhost` works on the laptop, but a phone needs HTTPS. Tunnel is fastest and cheapest. | Tunnel URL/latency on venue Wi-Fi. | Screen-record backup; run demo on laptop Chrome. |

Dependency budget (see CLAUDE.md §Dependencies): runtime `next react react-dom better-sqlite3 zod jose @anthropic-ai/sdk swr lucide-react tailwindcss`; dev `typescript vitest eslint @types/* tsx` (+ `@playwright/test` P1). Anything else needs a DECISIONS entry.

## 3. Repository layout

```
src/
  app/                    # Next.js: pages + route handlers (thin!)
    (auth)/login/  (app)/page.tsx  (app)/product/[id]/  (app)/reorder/  (app)/history/
    api/...                # route.ts files: parse → call service → envelope
  components/             # UI components (dashboard, voice sheet, cards, chips)
  client/                 # hooks: useSpeechRecognition, useVoiceSession, useDashboard
  shared/                 # zod schemas + types used by both sides (Interpretation, DTOs)
  server/
    config.ts logger.ts
    http/                 # withAuth, withRequestId, error envelope, rate limit
    auth/                 # pin hashing, session
    db/                   # connection.ts, migrate.ts, migrations/*.sql, repositories/*
    domain/               # PURE business logic — no HTTP, no LLM
      units/              # canonical units, lexicon-free conversion
      inventory/          # InventoryService (the ONLY writer of stock)
      insights/           # velocity, days-left, alert state, reorder suggestion
      policy.ts           # constants: thresholds, tiers
    voice/                # language → structured plan; no DB writes
      lexicon/            # numbers, units, verbs per language
      fallback-parser.ts  # deterministic parser
      llm/                # LlmClient interface, anthropic adapter, prompt, tool schema
      resolver.ts         # product/unit resolution against catalog
      planner.ts          # risk tiering, clarification, ValidatedPlan
      pipeline.ts         # orchestrates stages; persists voice_events
      answer.ts           # query execution (read-only) 
      templates/          # en.ts hi.ts te.ts (response strings)
evals/                    # utterances.jsonl, run.ts (real-LLM eval), fixtures/
scripts/                  # seed.ts, backup.ts, restore.ts
tests/                    # unit + integration
data/                     # SQLite files (gitignored)
docs/
```

**Dependency rules** (enforce with `eslint no-restricted-imports` once scaffolded):
`app → server/http → (voice | domain) → db`. `domain` never imports `voice`, `app`, `http`, or the LLM SDK. `voice` may **read** via repositories and domain read functions, but **never writes stock**. `shared` imports nothing internal. Only `domain/inventory/InventoryService` mutates `products.stock_base` or inserts into `inventory_transactions`.

## 4. Runtime view: the voice pipeline

```
Browser                           Server (POST /api/voice/interpret)                    DB
───────                           ─────────────────────────────────                     ──
mic → Web Speech ─transcript+alts─▶ 1 normalise text (NFC, digits, trim)
 (or typed text)                    2 language detect (script + lexicon hits) → {dominant, mixed}
                                    3 LLM interpret (catalog in prompt, forced tool JSON) ──┐ timeout 6 s
                                       └─on fail/timeout/invalid → fallback-parser          │
                                    4 zod-validate RawInterpretation                        │
                                    5 numeric cross-check: deterministic numbers vs LLM qty │
                                    6 resolve: product (alias/fuzzy), unit (universal/pack) ├─▶ read catalog, units
                                    7 plan: validate business rules, assign tier T0–T3,     │
                                       build questions/warnings → ValidatedPlan             │
                                    8 persist voice_event (status) ─────────────────────────┼─▶ INSERT voice_events
◀── {eventId, status, card|question|answer} ─ 9 for reads: execute query, render template   ┘
render Interpretation Card / Clarification
user taps Confirm (POST /api/voice/:id/confirm {patches?})
                                   10 load plan by eventId (server-side), apply patches, RE-VALIDATE
                                   11 InventoryService.apply(plan) — single SQLite txn ──▶ UPDATE products, INSERT txns
                                   12 render result template (+ learn alias/unit if patched) ─▶ voice_events.status=applied
◀── {result, stockAfter, message} ── 13 client: SWR mutate dashboard
```

Key properties:
- **The LLM stage outputs *language understanding only*.** It never sees write tools and never touches the DB.
- **The client never sends deltas for voice actions.** It sends `eventId` and optional *field patches* (e.g. `product_id`, `quantity`, `unit`); the server re-plans and re-validates. A forged request cannot write an arbitrary stock number via the voice route.
- **Confirm is idempotent:** `voice_events.status` transition `pending_confirm → applied` is checked inside the same transaction; a double tap applies once.
- **Deterministic path exists for everything numeric:** step 5 guards the most dangerous error class (wrong number).

## 5. Data model (SQLite)

All money/quantity values are **integers** (base units; paise if used). All tables carry `shop_id` even though the UI has one shop (cheap multi-tenant hygiene). Timestamps are ISO-8601 UTC text.

```sql
shops(id PK, name, default_language TEXT CHECK(in 'en','hi','te'), lead_time_days INT DEFAULT 2,
      cover_days INT DEFAULT 7, created_at)
users(id PK, shop_id FK, username UNIQUE, pin_hash, created_at)

products(id PK, shop_id FK, name, base_unit TEXT CHECK(base_unit IN ('piece','g','ml')),
         display_unit TEXT,                 -- preferred unit to show stock in (e.g. 'bag','kg','piece')
         stock_base INTEGER NOT NULL DEFAULT 0 CHECK(stock_base >= 0),   -- cached; ledger is truth
         low_threshold_base INTEGER NULL,   -- optional explicit threshold
         archived_at NULL, created_at, UNIQUE(shop_id, name))

product_units(id PK, product_id FK, unit TEXT, factor_base INTEGER NOT NULL CHECK(factor_base > 0),
              source TEXT CHECK(source IN ('seed','taught','manual')), created_at,
              UNIQUE(product_id, unit))     -- pack units only: bag/box/carton/packet/bottle/tin...
              -- universal units (kg,g,litre,ml,piece,dozen,quintal) live in code, not here

product_aliases(id PK, shop_id FK, product_id FK, alias TEXT, alias_norm TEXT, lang TEXT NULL,
                source TEXT CHECK(source IN ('seed','learned','manual')), use_count INT DEFAULT 0,
                UNIQUE(shop_id, alias_norm))

inventory_transactions(id PK, shop_id FK, product_id FK,
    type TEXT CHECK(type IN ('purchase','sale','adjustment','opening','reversal')),
    delta_base INTEGER NOT NULL,             -- signed, in base units
    stock_after_base INTEGER NOT NULL,
    qty_entered REAL, unit_entered TEXT,     -- what the user said (display/audit)
    unit_price_paise INTEGER NULL,           -- captured if spoken; unused in P0 UI
    source TEXT CHECK(source IN ('voice','manual','seed','undo')),
    voice_event_id NULL FK, reverses_txn_id NULL FK UNIQUE, note NULL,
    created_by FK users NULL, created_at)     -- append-only: no UPDATE/DELETE anywhere

voice_events(id PK, shop_id FK, user_id FK, parent_event_id NULL FK,   -- clarification chain
    transcript TEXT, stt_engine TEXT, stt_alternatives JSON NULL, stt_confidence REAL NULL,
    detected_language TEXT, interpreter TEXT CHECK(in 'llm','fallback'), llm_model NULL,
    raw_interpretation JSON, plan JSON NULL,   -- ValidatedPlan when applicable
    tier TEXT NULL, status TEXT CHECK(status IN
       ('answered','pending_confirm','needs_clarification','applied','cancelled','failed','expired')),
    error TEXT NULL, latency_ms INT, created_at, resolved_at NULL)
```

Invariant (tested): for every product, `stock_base == SUM(delta_base)` over its transactions, and `stock_base >= 0`.
Migrations: `src/server/db/migrations/NNN_name.sql`, applied in order by `migrate.ts`, tracked in a `schema_migrations` table. No down-migrations (hackathon); reseed instead.

## 6. Unit system

- **Base units:** `piece`, `g`, `ml` — every product has exactly one, integer stock in that unit. Dimension = count | mass | volume.
- **Universal units (code):** `piece=1 piece`, `dozen=12 piece`, `g=1 g`, `kg=1000 g`, `quintal=100000 g`, `ml=1 ml`, `litre=1000 ml`.
- **Pack units (per product, DB):** `bag, sack, box, carton, packet, bottle, tin, tray…` with a `factor_base` **only when configured/taught**. *Never defaulted.* Synonyms (బస్తా, बोरी, "gunny") map to canonical units in the lexicon; canonicalisation ≠ conversion.
- **Conversion:** `toBase(product, qty, unit)`:
  1. If `unit` is universal → require dimension match with `product.base_unit` else `unit_incompatible`.
  2. Else look up `product_units(product, unit)` → `qty × factor_base`; missing → `unit_undefined` (triggers *teach once* flow).
  3. Fractional results must be whole base units, else reject (`quantity_not_representable`).
- **Display:** `formatStock(product)` uses `display_unit` (universal or pack) with ≤2 decimals; P1 adds mixed form ("3 bags 10 kg"). The user's *spoken* unit is echoed in confirmations; normalised value shown in brackets when different ("2 bags (100 kg)").
- **Exactness:** use integers and `Math.round` only at parsing boundary; no floating accumulation.

## 7. Insight engine (deterministic, `domain/insights`)

Constants in `domain/policy.ts` (shop may override `lead_time_days`, `cover_days`):

```
WINDOW_DAYS = 14        MIN_SALE_TXNS = 3
LEAD_TIME_DAYS = 2      SAFETY_DAYS = 2       COVER_DAYS = 7
REORDER_TRIGGER_DAYS = LEAD_TIME_DAYS + SAFETY_DAYS   # = 4
```

- `velocity_base_per_day = Σ|delta| of sale txns in last WINDOW_DAYS ÷ WINDOW_DAYS` (only if ≥ `MIN_SALE_TXNS` sales; else `null` = "not enough history").
- `days_left = stock_base ÷ velocity` (null if velocity null/0).
- **Status:** `OUT` if stock = 0; else `LOW` if `stock ≤ low_threshold_base` (reason `BELOW_THRESHOLD`) **or** `days_left ≤ REORDER_TRIGGER_DAYS` (reason `RUNS_OUT_SOON`); else `OK`.
- **Reorder qty:** `need = velocity × (LEAD_TIME_DAYS + COVER_DAYS) − stock`; if `need > 0`, round **up** to the product's largest configured pack (or 1 kg/1 L/1 piece if none) → `{qty_base, packs, explanation inputs}`. The explanation object carries every number used so the UI/voice can show *why* (AC-062).
- "Sold today/this week" = Σ sale deltas over calendar windows in shop timezone (`Asia/Kolkata` fixed in MVP).

## 8. API surface (REST, JSON)

Envelope: success `{ ok:true, data }`, failure `{ ok:false, error:{ code, message, details? } }` with correct HTTP status. Every request gets `x-request-id` (generated if absent) that appears in logs.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` `{username,pin}` · `POST /api/auth/logout` · `GET /api/auth/me` | — / yes | Session cookie management, rate-limited login |
| `GET /api/dashboard` | yes | Products with stock/status, attention list, recent txns, summary counts |
| `GET/POST /api/products` · `GET/PATCH /api/products/:id` | yes | List/create/read/update (name, display_unit, threshold) |
| `POST /api/products/:id/units` · `POST /api/products/:id/aliases` | yes | Pack unit / alias management |
| `POST /api/products/:id/adjust` `{mode:'delta'|'set', qty, unit}` | yes | Manual correction (source=`manual`) |
| `GET /api/transactions?product=&limit=&cursor=` · `POST /api/transactions/:id/undo` | yes | History; reversal |
| `GET /api/insights/reorder` | yes | Reorder list with explanations |
| `POST /api/voice/interpret` `{transcript, alternatives?, locale?, engine, parentEventId?}` | yes | Pipeline steps 1–9 |
| `POST /api/voice/:id/confirm` `{patches?}` · `POST /api/voice/:id/cancel` | yes | Steps 10–12 |
| `POST /api/voice/transcribe` (multipart audio) | yes | **P1** server STT |
| `GET /api/health` | no | `{db:ok, llm:configured|missing, version}` (never leaks secrets) |

## 9. Cross-cutting

- **Config:** `server/config.ts` parses `process.env` with zod at boot; fails fast with a readable message. `.env.example` committed; `.env.local` gitignored. Only `ANTHROPIC_API_KEY`, `LLM_MODEL`, `SESSION_SECRET`, `DATABASE_PATH`, `DEMO_MODE` exist. No `NEXT_PUBLIC_` secret, ever.
- **Logging:** tiny JSON logger (`{ts, level, msg, requestId, shopId?, ...}`) — no PII beyond transcript (transcripts live in `voice_events` by design). Log LLM latency, model, fallback reason, validation failures. Never log the API key, PIN or full cookies.
- **Error handling:** domain throws typed `DomainError(code, message)`; `http` layer maps to status + envelope; unknown errors → 500 with generic message + logged stack. UI always shows a plain-language error with a retry/typed alternative.
- **Auth/session:** cookie `sid` (JWT HS256, 7 d, httpOnly, SameSite=Lax, Secure in prod). PIN 4–6 digits, scrypt with per-user salt, constant-time compare. In-memory login rate limit (5 failures/min per username+IP). POST routes require `content-type: application/json` (cheap CSRF hardening with SameSite).
- **Transactions:** `InventoryService.apply` runs in `db.transaction(...)`: re-read stock, re-check `stock_after ≥ 0`, insert txns, update cached stock, set voice_event status. Failure → full rollback, event `failed`.
- **Backup/restore:** `npm run backup` → `better-sqlite3` online `.backup()` to `backups/stockbol-YYYYMMDD-HHmmss.db` (keeps last 10); `npm run restore -- <file>` (stops if server running). Demo reset: `npm run seed`. Cloud: nightly copy of the volume file (documented, not automated).
- **Rate limiting the LLM:** per-user in-memory cap (e.g. 30 interpretations/min) to prevent runaway cost from a stuck client.
- **Prompt-injection stance:** transcripts and catalog names are *data*; the LLM has a single output tool (`emit_interpretation`); output is schema-validated; nothing executable results from it.

## 10. Testing strategy

| Layer | Tooling | What |
|---|---|---|
| Domain unit | Vitest | units, conversion, ledger, insights formulas, tiers |
| Voice unit | Vitest | lexicons, number parser, fallback parser, resolver, planner, number cross-check |
| Integration | Vitest + in-memory SQLite + mocked `LlmClient` | route handlers end-to-end (auth → interpret → confirm → dashboard), invariant checks |
| AI eval | `npm run eval:voice` (real LLM, needs key) | golden utterance set → intent/entity/unit accuracy + **unsafe-write count must be 0** |
| E2E (P1) | Playwright, typed input | login → speak(typed) → confirm → dashboard changed |
| Manual | Real Android phone, Chrome | mic, te-IN/hi-IN quality, layout at 360 px |

## 11. Degraded modes and "offline" — what is honestly achievable

| Failure | Behaviour |
|---|---|
| LLM timeout/5xx/429/invalid output | Fallback deterministic parser; banner "Basic mode — simple commands only"; complex phrases → clarification/typed help. |
| No Anthropic key | Same as above from boot; `/api/health` reports `llm: missing`. |
| Web Speech unsupported / mic denied / no-speech | Voice sheet switches to typed input with the same pipeline; explicit message. |
| Network loss (device) | Web Speech and LLM both unavailable → typed **manual adjust** on product detail still works only if the server is reachable. **True offline (queue + local STT) is out of scope (P2)**: local Whisper models are heavy and weak on Telugu at small sizes; we will not claim offline support. |
| DB error | 500 with request id; no partial writes (transaction rollback). |

## 12. Deployment

Primary: `npm run build && npm start` on the presenter's laptop + HTTPS tunnel for the phone. Secondary: one long-lived Node service with a persistent volume for `data/`. `next.config`: `serverExternalPackages: ['better-sqlite3']`. Node ≥ 22.

## 13. Top technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| Web Speech accuracy on te-IN/hi-IN code-mix | Core demo | Spike S1 on a real phone in Phase 1–2 (human task); LLM tolerant of noisy transcripts; STT alternatives passed to LLM; typed/demo-chip path; P1 server STT. |
| LLM misreads numbers/units | Wrong stock | Numeric cross-check (deterministic vs LLM); Tier-2 confirm on mismatch; always confirm writes; undo. |
| better-sqlite3 install fails on Windows | Blocks Phase 1 | Fallback `node:sqlite`/libsql via repository boundary (decision made in Phase 1 within 15 minutes). |
| Scope explosion | No polished demo | P0 gate at end of Phase 10; P1 only after; see CLAUDE.md scope rules. |
| Venue network | Live demo fails | Local run + tunnel; pre-recorded backup video; typed path. |
