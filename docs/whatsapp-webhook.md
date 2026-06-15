# WhatsApp Cloud API Integration

**Status:** Done — stores incoming messages for review/order generation
**Location:** `src/lib/whatsapp/` + `src/routes/api/webhook.whatsapp.ts`

## Overview

Handles incoming WhatsApp messages via Meta's Cloud API webhook. Text messages are stored in `incoming_messages` first so fragmented customer orders can be selected and combined in the UI before AI order generation.

## Files

| File | Purpose |
|------|---------|
| `src/lib/whatsapp/types.ts` | Full WhatsApp Cloud API type definitions + `extractTextMessages()` |
| `src/lib/whatsapp/mock.ts` | Mock payload factories + 3 sample order messages |
| `src/lib/whatsapp/index.ts` | Barrel re-exports |
| `src/routes/api/webhook.whatsapp.ts` | GET (verify) + POST (receive + store incoming messages) |
| `src/routes/api/incoming-messages.ts` | List incoming messages, store worker messages, generate orders from selected messages |
| `src/routes/api/events.incoming-messages.ts` | Server-Sent Events stream for live incoming-message refresh |
| `src/lib/events/incomingMessages.ts` | In-process event broker for incoming-message notifications |
| `src/lib/whatsapp/__tests__/types.test.ts` | 7 unit tests |

## Type Definitions

All types in `src/lib/whatsapp/types.ts`:

| Type | Description |
|------|-------------|
| `WhatsAppWebhookPayload` | Top-level webhook payload (`object`, `entry[]`) |
| `WhatsAppEntry` | Entry with `id`, `changes[]` |
| `WhatsAppChange` | Change with `field`, `value` |
| `WhatsAppChangeValue` | Contains `messages[]`, `contacts[]`, `statuses[]`, `metadata` |
| `WhatsAppMessage` | Union: text, image, document, audio, video, location, interactive, button, reaction |
| `WhatsAppContact` | Contact profile (`wa_id`, `profile.name`) |
| `WhatsAppStatus` | Delivery status updates |
| `WhatsAppMedia` | Media attachment (id, mime_type, sha256) |
| `WhatsAppLocation` | Lat/long/name/address |
| `WhatsAppInteractive` | Interactive message responses |
| `WhatsAppError` | Error payloads |
| `ExtractedMessage` | Simplified output: `{ from, name, messageId, body }` |

## Key Functions

### `extractTextMessages(payload: WhatsAppWebhookPayload): ExtractedMessage[]`
- Location: `src/lib/whatsapp/types.ts`
- Filters for `message.type === "text"` only
- Maps contact `wa_id` to `profile.name`
- Returns simplified `ExtractedMessage[]` with `from`, `name`, `messageId`, `body`
- Handles missing contacts gracefully (name defaults to empty)

### `createMockTextMessage(body, from?, timestamp?): WhatsAppWebhookPayload`
- Location: `src/lib/whatsapp/mock.ts`
- Creates a realistic webhook payload for testing
- Default sender: `"6591234567"`, name: `"Test Sender"`

### `createAllSamplePayloads(): WhatsAppWebhookPayload[]`
- Creates payloads from all 3 `SAMPLE_ORDER_MESSAGES`

## API Endpoints

### `GET /api/webhook/whatsapp` — Webhook Verification
- Reads query params: `hub.mode`, `hub.verify_token`, `hub.challenge`
- Compares token against `WHATSAPP_VERIFY_TOKEN` env var
- Returns challenge as plain text `200` on match, `403` otherwise

### `POST /api/webhook/whatsapp` — Incoming Messages → Review Queue
- Validates `payload.object === "whatsapp_business_account"`
- Calls `extractTextMessages()` on payload
- Returns `200` with empty body for non-text messages
- For each text message:
  1. Inserts a row into `incoming_messages`
  2. Ignores duplicate WhatsApp message IDs
  3. Publishes an `incoming-message` SSE event when a new row is stored
- Returns JSON with storage results per message

### `GET /api/incoming-messages?status=new`
- Lists raw incoming messages, newest first
- Used by the Orders page Incoming Messages tab

### `POST /api/incoming-messages`
- With `{ message, customerNameHint, from, timestamp, whatsappMessageId }`: stores a raw message from the WhatsApp group worker
- With `{ messageIds: number[] }`: combines selected new messages from one sender, parses them with AI, creates a draft order, and marks those messages as `used`

### `GET /api/events/incoming-messages`
- Server-Sent Events stream
- Emits `incoming-message` when a new incoming message is stored
- Current implementation is in-process, so multi-instance deployments need a shared pub/sub backend

## Sample Order Messages

Three realistic Singapore seafood distribution orders are in `SAMPLE_ORDER_MESSAGES`:
1. Multi-item order with Singlish abbreviations (lala, sotong, etc.)
2. Simple 3-item order
3. Order with specific packaging instructions

## Tests (7 total)

| Test | Validates |
|------|-----------|
| Extract single text message | Core extraction, messageId, contact name mapping |
| Empty array for status-only | No messages in payload |
| No-contacts gracefully | Missing contacts array |
| Ignore non-text types | Image messages filtered out |
| Multiple messages | Two senders, correct name mapping |
| Mock creates valid structure | `createMockTextMessage` shape validation |
| Timestamp passthrough | Custom timestamp honored |
