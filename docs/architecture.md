# Ordex Architecture

## Directory Structure

```
ordex/
├── docs/                          # Documentation & reference data
│   ├── research/                  # Time-bound investigations and primary-source findings
│   ├── excel sheets/              # AutoCount reference Excel files
│   ├── architecture.md            # This file
│   ├── whatsapp-group-worker.md   # WhatsApp Web group worker setup + env vars
│   ├── whatsapp-webhook.md        # WhatsApp integration docs
│   ├── ai-order-parser.md         # AI parser docs
│   ├── item-matcher.md            # Customer preference item matching
│   ├── database.md                # DB schema & operations
│   ├── api-routes.md              # All API endpoints
│   ├── frontend.md                # UI components & routes
│   ├── testing.md                 # Test coverage & patterns
│   └── test-examples.md           # Curl commands for testing
├── drizzle/                       # Generated SQL migrations
├── scripts/                       # Utility scripts
├── src/
│   ├── components/                # Shared React components
│   │   ├── orders/                # Order detail modal
│   │   └── shared/                # Reusable UI (PageHeader, StatusChip, etc.)
│   ├── db/                        # Database layer (schema, connection, seed)
│   ├── hooks/                     # React hooks (useApi, useDebounce)
│   ├── lib/                       # Feature modules
│   │   ├── db/                    # DB query functions (orders, items, debtors, invoices)
│   │   ├── events/                # In-process SSE event brokers
│   │   ├── matcher/               # Customer preference item matching
│   │   ├── parser/                # AI order parser (Ollama)
│   │   └── whatsapp/              # WhatsApp Cloud API types & helpers
│   ├── workers/                   # Long-running worker entrypoints
│   │   └── whatsapp-group/        # whatsapp-web.js group listener worker
│   ├── routes/                    # TanStack Start file-based routes
│   │   ├── api/                   # Server-only API handlers
│   │   ├── orders.tsx             # Order list + detail modal
│   │   ├── customers.tsx          # Customer listing
│   │   ├── items.tsx              # Item catalogue
│   │   ├── invoices.tsx           # Invoice history
│   │   └── index.tsx              # Homepage
│   ├── router.tsx                 # Router config
│   ├── routeTree.gen.ts           # Auto-generated route tree
│   ├── hero.ts                    # HeroUI Tailwind plugin export
│   └── styles.css                 # Tailwind v4 + HeroUI setup
├── biome.json                     # Linter/formatter config
├── drizzle.config.ts              # Drizzle ORM config
├── lefthook.yml                   # Git hooks (pre-commit lint)
├── mise.toml                      # Tool versions (Node 22, pnpm 10)
├── vite.config.ts                 # Vite + TanStack Start + Tailwind
└── vitest.config.ts               # Test runner config
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | TanStack Start (React + SSR) | 1.166.1 (pnpm lock) |
| Runtime | Node.js | 22.x |
| Worker runtime | Bun | latest (WhatsApp group worker only) |
| Package Manager | pnpm | 10.12.3 |
| Language | TypeScript | 5.9.3 (pnpm lock) |
| UI Library | HeroUI | 2.8.9 |
| CSS | Tailwind CSS v4 | 4.2.1 |
| Animation | Framer Motion | 12.34.4 |
| Icons | Lucide React | 0.545.0 |
| ORM | Drizzle ORM | 0.45.1 |
| Database | SQLite (better-sqlite3) | 12.6.2 |
| WhatsApp Web client | whatsapp-web.js | 1.34.7 |
| Excel | SheetJS (xlsx) | 0.18.5 |
| AI | Ollama (qwen2.5:7b) | local |
| Linter | Biome | 2.4.5 |
| Build | Vite | 7.3.1 (pnpm lock) |
| Tests | Vitest | 3.2.4 (pnpm lock) |
| Server | Nitro (nightly) | latest |

## Incoming Message Flow

Ordex now separates message receipt from order generation:

1. Meta webhook (`POST /api/webhook/whatsapp`) or WhatsApp group worker (`POST /api/incoming-messages`) stores raw text in `incoming_messages`.
2. Newly inserted messages publish an in-process `incoming-message` event.
3. The Orders page listens to `GET /api/events/incoming-messages` with `EventSource` and refetches incoming messages when events arrive.
4. Users select one or more messages from the same sender/customer in the Incoming Messages tab.
5. `POST /api/incoming-messages` with `{ messageIds }` combines the selected bodies, runs AI parsing/matching, creates a draft order, and marks the source messages `used`.

The SSE broker is process-local. If the app is deployed with multiple server instances, replace it with shared pub/sub such as Redis, database notifications, or a managed event bus.

## Configuration Files

### `vite.config.ts`
- Plugins: TanStack devtools, Nitro, tsconfig-paths, Tailwind v4, TanStack Start, React
- Path alias: `@` -> `./src`
- Nitro: externalizes `@sentry/*`

### `biome.json`
- Tab indentation, double quotes
- CSS Tailwind directives enabled
- `noExplicitAny` disabled for `routeTree.gen.ts`
- Import auto-sort enabled

### `drizzle.config.ts`
- SQLite dialect, schema at `./src/db/schema.ts`
- Migrations output to `./drizzle/`
- DB file: `ordex.db`

### `lefthook.yml`
- Pre-commit: `pnpm lint {staged_files}` with `stage_fixed: true`

### `pnpm-workspace.yaml`
- `allowBuilds` explicitly permits required native and install-time build scripts, including `better-sqlite3`, `esbuild`, and Puppeteer. This is required for a fresh `pnpm install` to produce the `better-sqlite3` native binding used by the database.

### Dependency lockfiles
- Use `pnpm install --frozen-lockfile` for a reproducible setup.
- `pnpm-lock.yaml` locks TanStack Start 1.166.1 with Vite 7.3.1. Do not broadly upgrade dependencies during setup: TanStack Start 1.169+ requires Vite 8 and falls back to Vite's missing-`index.html` error when paired with Vite 7.
- `bun.lock` is retained for the Bun-based WhatsApp worker; `db:seed` uses Node and `tsx` instead.

### `mise.toml`
- Node 22, pnpm 10.12.3
- Env files: `.env`, `.env.local`, `.env.local.tunnel`

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite dev --port 3000` | Start dev server |
| `build` | `vite build` | Production build |
| `test` | `vitest run` | Run all tests |
| `lint` | `biome check --write ...` | Lint & format |
| `whatsapp:start` | `bun run src/workers/whatsapp-group/index.ts` | Start the WhatsApp group worker |
| `whatsapp:dev` | `bun run --watch src/workers/whatsapp-group/index.ts` | Run the worker with Bun watch mode |
| `db:generate` | `drizzle-kit generate` | Generate migrations |
| `db:migrate` | `drizzle-kit migrate` | Apply migrations |
| `db:push` | `drizzle-kit push` | Push schema directly |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio |
| `db:seed` | `node --import tsx src/db/seed.ts` | Seed DB from Excel with Node (required by `better-sqlite3`) |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WHATSAPP_VERIFY_TOKEN` | `ordex-dev-token` | Webhook verification token |
| `ORDEX_API_URL` | `http://localhost:3000` | Base URL used by external workers to call Ordex APIs |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model for order parsing |
| `ANTHROPIC_API_KEY` | — | Anthropic SDK (installed, not yet used) |
| `WHATSAPP_SESSION_PATH` | `.wwebjs_auth` | LocalAuth session storage for the group worker |
| `WHATSAPP_CACHE_PATH` | `.wwebjs_cache` | Local WhatsApp Web version cache |
| `WHATSAPP_CLIENT_ID` | `ordex-group-worker` | WhatsApp group worker client id |
| `WHATSAPP_RECONNECT_DELAY_MS` | `5000` | Worker reconnect delay after disconnect/auth failure |
| `WHATSAPP_PUPPETEER_HEADLESS` | `true` | Whether the worker launches Chrome headlessly |
| `WHATSAPP_CHROME_EXECUTABLE_PATH` | — | Optional system Chrome/Chromium path |
| `WHATSAPP_QR_SMALL` | `true` | Render a compact QR code in the terminal |
| `WHATSAPP_INCLUDE_SELF_MESSAGES` | `false` | Test-only: store group messages sent by the linked account |
