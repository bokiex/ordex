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
**Purpose:** Receive WhatsApp Cloud API messages and store text messages for review/order generation

**Request Body:** `WhatsAppWebhookPayload` (from Meta Cloud API)

**Logic:**
1. Validates `payload.object === "whatsapp_business_account"`
2. Calls `extractTextMessages(payload)`
3. Non-text messages → `200` empty body
4. For each text message:
   a. Inserts `incoming_messages` row
   b. Deduplicates by WhatsApp message ID
   c. Publishes an `incoming-message` SSE event for newly inserted rows

**Response (success):**
```json
{
  "received": 1,
  "messages": [
    {
      "from": "6591234567",
      "name": "Customer Name",
      "messageId": "wamid.xxx",
      "incomingMessageId": 1,
      "duplicate": false
    }
  ]
}
```

---

### `GET /api/incoming-messages`

**File:** `src/routes/api/incoming-messages.ts`
**Purpose:** List raw incoming WhatsApp messages for manual review

**Query Params:**
- `?status=new|used` — optional filter

**Response:** Array of incoming message rows, newest first.

---

### `POST /api/incoming-messages`

**File:** `src/routes/api/incoming-messages.ts`
**Purpose:** Store raw worker messages, or generate a draft order from selected incoming messages

**Raw message request body:**
```json
{
  "message": "string (required)",
  "customerNameHint": "string (optional) — WhatsApp group display name",
  "groupJid": "string (optional) — stable WhatsApp group JID ending in @g.us",
  "senderName": "string (optional)",
  "from": "string (optional)",
  "timestamp": "string (optional)",
  "whatsappMessageId": "string (optional)"
}
```

Used by the WhatsApp group worker. This path does not parse with AI; it only stores the message and returns `201` for a new row or `200` for a duplicate. Missing `groupJid` is accepted for older workers, but creates an unknown-identity message that can only be selected individually. An invalid supplied JID returns `400`.

**Delete incoming messages request:**
```json
{
  "messageIds": [1, 2, 3]
}
```

`DELETE /api/incoming-messages` removes selected messages that are still in the `new` state.

**Generate order request body:**
```json
{
  "messageIds": [1, 2, 3]
}
```

**Generate order logic:**
1. Loads selected `new` incoming messages in timestamp order
2. Rejects selections spanning more than one source-qualified conversation; unknown-identity messages can only be selected individually
3. Combines message bodies with newlines, then parses and matches them without holding a database transaction. The newest selected message's customer hint (or sender name) is used for matching.
4. Rechecks message availability and atomically creates the draft and its lines and marks all source messages `used` with `sourceOrderId`
5. Publishes change events after the transaction commits; a concurrent losing request receives `409`

**Error Responses:**
- `400` — Missing/invalid request fields, or messages from different or unknown conversations
- `409` — One or more selected messages are unavailable or already used
- `502` — Ollama failure during generate-order flow
- `500` — DB error

---

### `GET /api/events/incoming-messages`

**File:** `src/routes/api/events.incoming-messages.ts`
**Purpose:** Server-Sent Events stream for live incoming-message updates

**Events:**
- `connected` — sent when the stream opens
- `incoming-message` — sent after a new incoming message row is inserted
- `: keepalive` comment every 25 seconds

The browser listens with `EventSource` and refetches `/api/incoming-messages?status=new` when `incoming-message` arrives. The current broker is in-process; multi-instance deployments need shared pub/sub.

---

### `POST /api/parse-order`

**File:** `src/routes/api/parse-order.ts`
**Purpose:** Parse a WhatsApp order message using AI (Ollama) — standalone endpoint, no order creation

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
  "items": [
    {
      "rawText": "original line",
      "itemName": "normalized name",
      "qty": 10,
      "uom": "pkt"
    }
  ],
  "notes": "string | null"
}
```

**Error Responses:**
- `400` — Missing/invalid `message` field
- `502` — Ollama failure or parsing error

---

### `GET /api/orders`

**File:** `src/routes/api/orders.ts`
**Purpose:** List orders with debtor info

**Query Params:**
- `?status=draft|confirmed|exported` — optional filter

**Response:** Array of orders with `debtorCompanyName` joined from debtors table.

---

### `POST /api/orders`

**File:** `src/routes/api/orders.ts`
**Purpose:** Create an order by parsing a WhatsApp message with AI + customer preference matching

**Request Body:**
```json
{
  "message": "string (required) — raw order text",
  "date": "string (optional) — date context",
  "customerNameHint": "string (optional) — sender/contact name from the caller"
}
```

**Logic:**
1. Parse message via Ollama → `ParsedOrder`
2. Match customer name → debtor code using parsed customer name first, then `customerNameHint` (populates `debtorCode`, `debtorName`, `agent`)
3. Load `getDebtorItemPreferences(debtorCode)` for customer's purchase history
4. For each parsed item, call `matchItem(itemName, preferences)`:
   - Tries customer history first (preferred manufacturer)
   - Falls back to catalogue search
   - Populates `unitPrice` from history if available
5. Create draft order with line items

**Response:** `201` with full `OrderWithItems` JSON.

**Error Responses:**
- `400` — Missing/invalid `message` field
- `400` — Invalid `customerNameHint` field
- `502` — Ollama failure
- `500` — DB error

---

### `GET /api/orders/:id`

**File:** `src/routes/api/orders.$id.ts`
**Purpose:** Get full order with debtor info and line items (with matched item data)

---

### `PUT /api/orders/:id`

**File:** `src/routes/api/orders.$id.ts`
**Purpose:** Update order header fields (debtorCode, docDate, etc.)

---

### `DELETE /api/orders/:id`

**File:** `src/routes/api/orders.$id.ts`
**Purpose:** Delete an order and all its line items

---

### `POST /api/orders/:id/confirm`

**File:** `src/routes/api/orders.$id.confirm.ts`
**Purpose:** Set order status to `confirmed`

---

### `GET /api/orders/:id/export`

**File:** `src/routes/api/orders.$id.export.ts`
**Purpose:** Generate and download an Excel (`.xlsx`) file for a confirmed/exported order

**Behavior:**
- Returns `400` if order is still in `draft`
- Marks order status as `exported` on first successful export
- Returns file as attachment with two sheets (`Order Summary`, `Line Items`)

---

### `POST /api/orders/:id/items`

**File:** `src/routes/api/orders.$id.items.ts`
**Purpose:** Add a line item to an existing order

---

### `PUT /api/order-items/:id`

**File:** `src/routes/api/order-items.$id.ts`
**Purpose:** Update an order line item

---

### `DELETE /api/order-items/:id`

**File:** `src/routes/api/order-items.$id.ts`
**Purpose:** Delete an order line item

---

### `GET /api/debtors`

**File:** `src/routes/api/debtors.ts`
**Purpose:** List or search debtors (`?search=` for fuzzy match)

---

### `GET /api/items`

**File:** `src/routes/api/items.ts`
**Purpose:** List or search items (`?search=` for fuzzy match), including their stored `price`
