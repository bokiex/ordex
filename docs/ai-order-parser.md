# AI Order Parser

**Status:** Done (ORD-7)
**Location:** `src/lib/parser/`

## Overview

Parses unstructured WhatsApp order messages into structured `ParsedOrder` objects using Ollama (qwen2.5:7b model). Designed for Singapore seafood distribution context.

## Files

| File | Purpose |
|------|---------|
| `src/lib/parser/types.ts` | `ParsedOrder`, `ParsedOrderItem`, Ollama API types |
| `src/lib/parser/prompt.ts` | System prompt constant + prompt builder |
| `src/lib/parser/ollama.ts` | `parseOrderMessage()` + `validateParsedOrder()` |
| `src/lib/parser/index.ts` | Barrel re-exports |
| `src/routes/api/parse-order.ts` | POST API handler |
| `src/lib/parser/__tests__/parser.test.ts` | 10 unit tests |

## Type Definitions

### `ParsedOrder`
```typescript
{
  customerName: string | null;    // Extracted customer name
  deliveryDate: string | null;    // Extracted delivery date
  rawText: string;                // Original message text
  items: ParsedOrderItem[];       // Parsed line items
}
```

### `ParsedOrderItem`
```typescript
{
  itemName: string;     // Product name as mentioned
  qty: number;          // Quantity ordered
  uom: string;          // Unit of measure (defaults to "pkt")
  notes?: string;       // Additional instructions
}
```

### Ollama API Types
- `OllamaGenerateRequest` — Request shape for `/api/generate`
- `OllamaGenerateResponse` — Response shape with `response` field containing JSON string

## Key Functions

### `parseOrderMessage(text: string, date?: string): Promise<ParsedOrder>`
- Location: `src/lib/parser/ollama.ts`
- Calls Ollama REST API at `OLLAMA_BASE_URL/api/generate`
- Model: `qwen2.5:7b`
- Temperature: `0.1` (deterministic)
- JSON output mode (`format: "json"`)
- Max tokens: 1024 (`num_predict`)
- Timeout: none (Ollama can be slow on first load)
- Returns validated `ParsedOrder`

### `buildOrderParserPrompt(text: string, date?: string): string`
- Location: `src/lib/parser/prompt.ts`
- Combines `ORDER_PARSER_SYSTEM_PROMPT` with user message and date
- Date defaults to today if not provided
- System prompt is tailored for:
  - Singapore seafood distribution context
  - Singlish abbreviations (lala = clam, sotong = squid)
  - SGD currency
  - Common UOMs: pkt, ctn, kg, tube, btl

### `validateParsedOrder(jsonString: string): ParsedOrder`
- Location: `src/lib/parser/ollama.ts`
- Parses JSON string from Ollama response
- Validates required fields (`items` array, each item needs `itemName` + `qty`)
- Defaults: `uom` → `"pkt"`, `customerName` → `null`, `deliveryDate` → `null`
- Filters out invalid items (keeps valid ones)
- Throws if no valid items remain
- Coerces `rawText` to string

## API Endpoint

### `POST /api/parse-order`
- Location: `src/routes/api/parse-order.ts`
- Request body: `{ message: string, date?: string }`
- Success: Returns `ParsedOrder` JSON
- Error 400: Missing/invalid `message` field
- Error 502: Ollama connection failure or parsing error

## Tests (10 total)

| Test | Validates |
|------|-----------|
| Prompt includes system prompt + message | Prompt construction |
| Prompt includes today's date | Date injection |
| Valid JSON → ParsedOrder | Happy path with 2 items |
| Default missing UOM to "pkt" | UOM defaulting |
| Default missing customerName/deliveryDate to null | Null defaulting |
| Throw on no valid items | Empty items array |
| Throw on missing required fields | Items without qty/itemName |
| Throw on non-object JSON | Invalid top-level type |
| Filter invalid items, keep valid | Mixed validity |
| Coerce rawText to string | Numeric rawText |

**Note:** Tests are pure validation tests — they do NOT make live Ollama API calls.
