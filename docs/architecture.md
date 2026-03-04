# Ordex Architecture

## Directory Structure

```
ordex/
├── docs/                          # Documentation & reference data
│   ├── excel sheets/              # AutoCount reference Excel files
│   ├── architecture.md            # This file
│   ├── whatsapp-webhook.md        # WhatsApp integration docs
│   ├── ai-order-parser.md         # AI parser docs
│   ├── database.md                # DB schema & operations
│   ├── api-routes.md              # All API endpoints
│   ├── frontend.md                # UI components & routes
│   └── testing.md                 # Test coverage & patterns
├── drizzle/                       # Generated SQL migrations
├── scripts/                       # Utility scripts
├── src/
│   ├── components/                # Shared React components
│   ├── db/                        # Database layer (schema, connection, seed)
│   ├── lib/                       # Feature modules
│   │   ├── parser/                # AI order parser (Ollama)
│   │   └── whatsapp/              # WhatsApp Cloud API types & helpers
│   ├── routes/                    # TanStack Start file-based routes
│   │   ├── api/                   # Server-only API handlers
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
| Framework | TanStack Start (React + SSR) | 1.132.x |
| Runtime | Bun | latest |
| Package Manager | pnpm | 10.12.3 |
| Language | TypeScript | 5.7.2 |
| UI Library | HeroUI | 2.8.9 |
| CSS | Tailwind CSS v4 | 4.1.18 |
| Animation | Framer Motion | 12.34.4 |
| Icons | Lucide React | 0.545.0 |
| ORM | Drizzle ORM | 0.45.1 |
| Database | SQLite (better-sqlite3) | 12.6.2 |
| Excel | SheetJS (xlsx) | 0.18.5 |
| AI | Ollama (qwen2.5:7b) | local |
| Linter | Biome | 2.4.5 |
| Build | Vite | 7.1.7 |
| Tests | Vitest | 3.0.5 |
| Server | Nitro (nightly) | latest |

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
| `db:generate` | `drizzle-kit generate` | Generate migrations |
| `db:migrate` | `drizzle-kit migrate` | Apply migrations |
| `db:push` | `drizzle-kit push` | Push schema directly |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio |
| `db:seed` | `bun run src/db/seed.ts` | Seed DB from Excel |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WHATSAPP_VERIFY_TOKEN` | `ordex-dev-token` | Webhook verification token |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `ANTHROPIC_API_KEY` | — | Anthropic SDK (installed, not yet used) |
