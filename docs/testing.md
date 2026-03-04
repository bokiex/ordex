# Testing

**Framework:** Vitest 3.0.5 with jsdom environment
**Config:** `vitest.config.ts` — includes all `src/**/*.test.ts`
**Run:** `bun run test`

## Test Coverage Summary

| Module | File | Tests | Type |
|--------|------|-------|------|
| WhatsApp | `src/lib/whatsapp/__tests__/types.test.ts` | 7 | Unit (pure logic) |
| Parser | `src/lib/parser/__tests__/parser.test.ts` | 10 | Unit (pure logic) |
| **Total** | | **17** | |

All tests are pure logic — no network calls, no database, no mocking needed.

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

## Test Patterns Used

- **No mocking:** Tests validate pure functions (prompt building, JSON validation)
- **No network:** Ollama API is not called in tests
- **Barrel imports:** Tests import from module index (`@/lib/parser`, `@/lib/whatsapp`)
- **Path aliases:** Uses `@/` prefix via `vite-tsconfig-paths`

## Adding New Tests

1. Create `__tests__/` directory in your module
2. Name file `*.test.ts`
3. Import from module barrel (`@/lib/your-module`)
4. Use `describe`/`it` from Vitest
5. Run: `bun run test`
