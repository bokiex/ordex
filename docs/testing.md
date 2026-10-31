# Testing

**Framework:** Vitest 3.2.4 with node environment
**Config:** `vitest.config.ts` — includes all `src/**/*.test.ts`
**Run:** `pnpm test`

## Test Coverage Summary

| Module | File | Tests | Type |
|--------|------|-------|------|
| WhatsApp | `src/lib/whatsapp/__tests__/types.test.ts` | 7 | Unit (pure logic) |
| Parser | `src/lib/parser/__tests__/parser.test.ts` | 10 | Unit (pure logic) |
| Matcher | `src/lib/matcher/__tests__/matcher.test.ts` | 22 | Unit (mocked catalogue access) |
| WhatsApp Group Worker | `src/workers/whatsapp-group/__tests__/config.test.ts` | 3 | Unit (env parsing) |
| WhatsApp Group Worker | `src/workers/whatsapp-group/__tests__/client.test.ts` | 2 | Unit (client options) |
| WhatsApp Group Worker | `src/workers/whatsapp-group/__tests__/handlers.test.ts` | 10 | Unit (message filtering, display-name requirement, mocked fetch) |
| WhatsApp Group Worker | `src/workers/whatsapp-group/__tests__/groupNames.test.ts` | 2 | Unit (WhatsApp group display-name cache) |
| Database seed | `src/db/__tests__/seed.test.ts` | 1 | Integration (temporary migrated SQLite DB + configured seed command) |
| **Total** | | **57** | |

Most tests are unit-scoped. The worker handler tests use mocked `fetch` and logger calls. The seed integration test has no network dependency: it creates and cleans up an isolated SQLite database.

## WhatsApp Tests (7)

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | Extract single text message | Core extraction, messageId, contact name |
| 2 | Empty array for status-only | Payloads without messages |
| 3 | No-contacts gracefully | Missing contacts array handling |
| 4 | Ignore non-text types | Image messages filtered out |
| 5 | Multiple messages | Two senders, correct name mapping |
| 6 | Mock creates valid structure | `createMockTextMessage` shape |
| 7 | Timestamp passthrough | Custom timestamp honored |

## Parser Tests (10)

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | Prompt includes system + message | Prompt construction |
| 2 | Prompt includes date | Date injection format |
| 3 | Valid JSON → ParsedOrder | Full happy path |
| 4 | Default UOM to "pkt" | Missing UOM handling |
| 5 | Default null fields | Missing customerName/deliveryDate |
| 6 | Throw on empty items | No valid items |
| 7 | Throw on missing required | Items without qty/itemName |
| 8 | Throw on non-object | Invalid JSON shape |
| 9 | Filter invalid items | Mixed validity array |
| 10 | Coerce rawText | Numeric rawText → string |

## Matcher Tests (22)

| Area | Tests | What It Validates |
|------|-------|-------------------|
| `tokenize()` | 4 | Lowercasing, noise/UOM filtering, slash-number preservation, and noise-only input |
| `findBestPreference()` | 6 | Frequency-based selection, specific-size matches, multi-word matching, and no-match cases |
| `matchItem()` | 12 | History tie-breakers, active catalogue prices, fuzzy and token matching, catalogue ranking, stale history rejection, empty catalogue handling, and noodle variants |

## WhatsApp Group Worker Tests (17)

| Area | Tests | What It Validates |
|------|------:|-------------------|
| Config | 3 | Defaults, environment overrides including temporary self-message capture, and invalid values |
| Client options | 2 | `LocalAuth`, local web cache, and Puppeteer options |
| Message handler | 10 | Sender attribution, payload building, group-JID filtering, self-message behavior, display-name requirement, event registration, storage, and empty-message handling |
| Group display-name cache | 2 | Cached JID → display-name lookup and concurrent cache refresh coalescing |

## Database Seed Test (1)

The seed integration test applies all Drizzle migrations to a temporary SQLite database, runs the configured `db:seed` package command, checks that each reference-data table has rows, and deletes the temporary database. It prevents a regression to the unsupported Bun + `better-sqlite3` runtime combination.

## Manual API Testing

See `docs/test-examples.md` for curl commands with real customer/item data to test the full pipeline.

## Test Patterns Used

- **Light mocking:** Worker handler tests mock `fetch` and logger calls; all other tests stay pure
- **No network:** Ollama API is not called in tests
- **Imports:** Existing lib tests use module barrels; worker tests import module-local files directly because the worker has no barrel yet
- **Path aliases:** Uses `@/` prefix via `vite-tsconfig-paths`

## Adding New Tests

1. Create `__tests__/` directory in your module
2. Name file `*.test.ts`
3. Import from module barrel (`@/lib/your-module`)
4. Use `describe`/`it` from Vitest
5. Run: `pnpm test`
