# WhatsApp Group Worker

**Status:** Done
**Location:** `src/workers/whatsapp-group/`

## Overview

Runs a separate `whatsapp-web.js` worker process that listens to WhatsApp Web group messages, logs each inbound group message, and forwards the raw text to `POST /api/incoming-messages` with sender metadata.

The worker does not parse messages or create orders directly. Messages land in the Incoming Messages tab, where users can select one or more fragments from the same customer and generate a draft order with AI.

This is separate from the existing Meta Cloud API webhook flow. The worker is useful when the source messages live in shared WhatsApp groups instead of a business webhook inbox.

## Files

| File | Purpose |
|------|---------|
| `src/workers/whatsapp-group/config.ts` | Reads env vars and resolves API/session/cache config |
| `src/workers/whatsapp-group/client.ts` | Creates a `whatsapp-web.js` client with `LocalAuth` |
| `src/workers/whatsapp-group/handlers.ts` | Filters group messages, logs them, and posts them to `/api/incoming-messages` |
| `src/workers/whatsapp-group/index.ts` | Main worker entrypoint, QR auth, lifecycle hooks, reconnect handling |
| `src/workers/whatsapp-group/__tests__/` | Unit tests for config parsing, client options, and handler logic |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ORDEX_API_URL` | `http://localhost:3000` | Base URL for the Ordex app |
| `WHATSAPP_SESSION_PATH` | `.wwebjs_auth` | LocalAuth session storage directory |
| `WHATSAPP_CACHE_PATH` | `.wwebjs_cache` | WhatsApp Web version cache directory |
| `WHATSAPP_CLIENT_ID` | `ordex-group-worker` | LocalAuth client id |
| `WHATSAPP_RECONNECT_DELAY_MS` | `5000` | Delay before reconnecting after disconnect/auth failure |
| `WHATSAPP_PUPPETEER_HEADLESS` | `true` | Launch browser headlessly |
| `WHATSAPP_CHROME_EXECUTABLE_PATH` | — | Optional Chrome/Chromium path override |
| `WHATSAPP_QR_SMALL` | `true` | Render compact QR codes in the terminal |

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Ensure Puppeteer has a browser available.

Fresh `pnpm` installs can block Puppeteer postinstall scripts. If the worker fails to launch Chrome/Chromium, run:

```bash
pnpm exec puppeteer browsers install chrome
```

If you want to use a system browser instead, set `WHATSAPP_CHROME_EXECUTABLE_PATH`.

3. Start the Ordex app:

```bash
pnpm dev
```

4. Start the worker in a second terminal:

```bash
pnpm whatsapp:start
```

For watch mode during development:

```bash
pnpm whatsapp:dev
```

5. On first startup, scan the QR code printed in the terminal with WhatsApp on your phone. The linked session is persisted under `.wwebjs_auth/`.

## Runtime Behavior

- Only group messages are processed (`chat.isGroup === true`)
- Messages sent by the worker account itself are skipped
- Customer matching uses the WhatsApp group name
- Sender names still come from the WhatsApp contact (`pushname` → `name` → `shortName` → number) for attribution
- Every group message is logged with timestamp, group name, sender, and flattened message body
- Incoming messages are stored by `POST`ing to `/api/incoming-messages` with:

```json
{
  "message": "raw group message text",
  "customerNameHint": "WhatsApp group name",
  "senderName": "sender display name",
  "from": "6591111111",
  "timestamp": "1713900000",
  "whatsappMessageId": "wamid.xxx"
}
```

- The API returns success after storage; incomplete or non-order fragments do not fail AI parsing at receive time
- A newly stored message publishes an `incoming-message` SSE event so the web app refreshes automatically
- `disconnected` and `auth_failure` events schedule an automatic reconnect attempt after `WHATSAPP_RECONNECT_DELAY_MS`

## Example `.env.local`

```bash
ORDEX_API_URL=http://localhost:3000
WHATSAPP_SESSION_PATH=.wwebjs_auth
WHATSAPP_CACHE_PATH=.wwebjs_cache
WHATSAPP_RECONNECT_DELAY_MS=5000
WHATSAPP_PUPPETEER_HEADLESS=true
```
