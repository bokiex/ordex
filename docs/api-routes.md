# API Routes

All routes use TanStack Start's `server.handlers` pattern (not `createServerFn`).

## Endpoints

### `GET /api/webhook/whatsapp`

**File:** `src/routes/api/webhook.whatsapp.ts`
**Purpose:** Meta WhatsApp Cloud API webhook verification

| Parameter | Source | Required |
|-----------|--------|----------|
| `hub.mode` | query | yes (`subscribe`) |
| `hub.verify_token` | query | yes |
| `hub.challenge` | query | yes |

**Responses:**
- `200` + challenge string (plain text) — token matches `WHATSAPP_VERIFY_TOKEN`
- `403` Forbidden — token mismatch

---

### `POST /api/webhook/whatsapp`

**File:** `src/routes/api/webhook.whatsapp.ts`
**Purpose:** Receive incoming WhatsApp messages

**Request Body:** `WhatsAppWebhookPayload` (from Meta Cloud API)

**Logic:**
1. Validates `payload.object === "whatsapp_business_account"`
2. Calls `extractTextMessages(payload)` from `src/lib/whatsapp/types.ts`
3. Non-text messages → `200` empty body
4. Text messages → logs + returns preview JSON

**Response (text messages):**
```json
{
  "received": 2,
  "messages": [
    {
      "from": "6591234567",
      "name": "Customer Name",
      "messageId": "wamid.xxx",
      "bodyPreview": "first 100 chars..."
    }
  ]
}
```

**TODO:** Not yet wired to AI parser for automatic order parsing.

---

### `POST /api/parse-order`

**File:** `src/routes/api/parse-order.ts`
**Purpose:** Parse a WhatsApp order message using AI (Ollama)

**Request Body:**
```json
{
  "message": "string (required) — raw order text",
  "date": "string (optional) — date context, defaults to today"
}
```

**Response (success):**
```json
{
  "customerName": "string | null",
  "deliveryDate": "string | null",
  "rawText": "original message",
  "items": [
    {
      "itemName": "lala",
      "qty": 10,
      "uom": "pkt",
      "notes": "optional"
    }
  ]
}
```

**Error Responses:**
- `400` — `{ "error": "Message is required" }` (missing/invalid body)
- `502` — `{ "error": "..." }` (Ollama failure or parsing error)

**Dependencies:** Requires Ollama running at `OLLAMA_BASE_URL` with `qwen2.5:7b` model.
