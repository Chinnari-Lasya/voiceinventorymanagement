# AI Voice Inventory Copilot (Stockbol)

A voice/text-driven inventory copilot for small shops. You say or type a command such as
"add 5 bags of rice" or "sold 3 kg sugar"; the app shows what it understood, asks you to
confirm, updates the stock, and lets you undo the last change.

Frontend and backend live in one Next.js (App Router) project:

| Part | Location |
|---|---|
| Frontend (React UI) | `src/app`, `src/components` |
| Backend (API route handlers) | `src/app/api/**` |
| Business logic, voice parsing | `src/server/domain`, `src/server/voice` |
| Database (SQLite) + migrations | `src/server/db` (`migrations/001_init.sql`) |
| Shared types | `src/shared` |
| Tests (Vitest) | `tests/` |
| Docs and specs | `docs/`, `CLAUDE.md` |

## Requirements

- Node.js 22 or newer, npm
- A C/C++ toolchain is only needed if `better-sqlite3` has no prebuilt binary for your platform

## Setup and run

```bash
npm install
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev                     # http://localhost:3000
```

The SQLite file (`./data/stockbol.db`) and the demo shop are created automatically on first
request. Development mode needs no secrets.

### Production mode

`SESSION_SECRET` (32+ characters) is mandatory in production:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste into .env.local
npm run build
npm run start
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run check        # all three
```

## Environment variables

See `.env.example`. `ANTHROPIC_API_KEY` is optional: without it the app runs in "Basic mode"
using the built-in deterministic parser. Never commit `.env.local`.

## API (demo shop)

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Service, database and LLM status |
| `GET /api/demo/state` | Products, stock, recent transactions, undo target |
| `POST /api/demo/interpret` | `{ "text": "add 5 bags of rice" }` returns a proposal; never changes stock |
| `POST /api/demo/confirm` | Applies a confirmed change atomically with a ledger row |
| `POST /api/demo/undo` | Reverses the last change with a compensating ledger entry |

## Status

Early prototype. The demo flow (interpret, confirm, undo, ledger consistency, oversell guard)
is implemented and tested. The LLM layer, auth and multilingual work are planned; see
`docs/PROGRESS.md` and `docs/IMPLEMENTATION_PLAN.md`. Scripts mentioned in `CLAUDE.md` such as
`seed`, `backup`, `restore` and `eval:voice` are not implemented yet.
