# WhatsApp Group Worker

**Status:** Done
**Location:** `src/workers/whatsapp-group/`

## Overview

Runs a separate `whatsapp-web.js` worker process that listens to WhatsApp Web group messages, logs each inbound group message, and forwards the raw text to `POST /api/incoming-messages` with sender metadata.

The worker does not parse messages or create orders directly. Messages land in the Incoming Messages tab, where users can select one or more fragments from the same conversation and generate a draft order with AI.

This is separate from the existing Meta Cloud API webhook flow. The worker is useful when the source messages live in shared WhatsApp groups instead of a business webhook inbox.

The project uses `whatsapp-web.js` v1.34.7. It includes the upstream [frozen-start/auth-timeout fix](https://github.com/wwebjs/whatsapp-web.js/pull/127048); do not downgrade the locked dependency when setting up the worker.

## Files

| File | Purpose |
|------|---------|
| `src/workers/whatsapp-group/config.ts` | Reads env vars and resolves API/session/cache config |
| `src/workers/whatsapp-group/client.ts` | Creates a `whatsapp-web.js` client with `LocalAuth` |
| `src/workers/whatsapp-group/groupNames.ts` | Loads and caches visible group display names from WhatsApp Web's chat collection |
| `src/workers/whatsapp-group/handlers.ts` | Filters group messages, resolves their display names, logs them, and posts them to `/api/incoming-messages` |
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
| `WHATSAPP_INCLUDE_SELF_MESSAGES` | `false` | Also store messages sent by the linked account; use only for testing |

## Setup

1. On Ubuntu, install the Chrome runtime libraries required by Puppeteer:

```bash
sudo apt update
sudo apt install -y libnspr4 libnss3 libasound2t64
```

On Ubuntu releases without `libasound2t64`, install `libasound2` instead.

2. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

`pnpm-workspace.yaml` uses `allowBuilds` to permit Puppeteer's install script, along with the other required native build scripts, during a fresh install. If pnpm reports ignored build scripts, run `pnpm approve-builds`, approve Puppeteer and `better-sqlite3`, then rerun the install command.

3. Ensure Puppeteer has a browser available.

If the worker fails to launch Chrome/Chromium, run:

```bash
pnpm exec puppeteer browsers install chrome
```

If you want to use a system browser instead, set `WHATSAPP_CHROME_EXECUTABLE_PATH`.

4. Start the Ordex app:

```bash
pnpm dev
```

5. Start the worker in a second terminal:

```bash
pnpm whatsapp:start
```

For watch mode during development:

```bash
pnpm whatsapp:dev
```

6. On first startup, scan the QR code printed in the terminal with WhatsApp on your phone. Wait for the `Ready. Forwarding group messages ...` lifecycle log before testing an inbound group message. The linked session is persisted under `.wwebjs_auth/`.

## Runtime Behavior

- Only group messages are processed. The worker detects group chats from the message chat JID (`@g.us`) rather than requiring a WhatsApp Web chat-model lookup.
- Messages sent by the worker account itself are skipped by default
- Set `WHATSAPP_INCLUDE_SELF_MESSAGES=true` only for testing. The worker then listens to WhatsApp Web's `message_create` event for messages with `fromMe === true`; inbound messages remain handled by the `message` event and are not duplicated.
- On `ready`, the worker loads a group-JID → display-name cache from WhatsApp Web's already-loaded chat collection. It refreshes the cache after group updates and when it misses a group.
- A group message is stored only when its display name is resolved. This preserves the display name as `customerNameHint`, which is required for customer matching; the worker never substitutes the group JID. The separate `groupJid` identifies the conversation even if the group is renamed.
- Sender names still come from the WhatsApp contact (`pushname` → `name` → `shortName` → number) for attribution
- Every group message is logged with timestamp, group display name, sender, and flattened message body
- Incoming messages are stored by `POST`ing to `/api/incoming-messages` with:

```json
{
  "message": "raw group message text",
  "customerNameHint": "WhatsApp group display name",
  "groupJid": "120363000000000000@g.us",
  "senderName": "sender display name",
  "from": "6591111111",
  "timestamp": "1713900000",
  "whatsappMessageId": "wamid.xxx"
}
```

- The API returns success after storage; incomplete or non-order fragments do not fail AI parsing at receive time
- A newly stored message publishes an `incoming-message` SSE event so the web app refreshes automatically
- `disconnected` and `auth_failure` events schedule an automatic reconnect attempt after `WHATSAPP_RECONNECT_DELAY_MS`

## Upgrade and older messages

Apply migrations (`pnpm db:migrate`) and deploy the web app before restarting the updated worker. An older worker can still send requests without `groupJid`, but each such message is isolated and must be selected individually. Existing rows have unknown identity too: group JIDs cannot safely be reconstructed from names or senders. These rows and their order links are retained. Once the worker is upgraded, newly received messages can be grouped by JID; old unknown messages are not merged into those groups.

## Example `.env.local`

```bash
ORDEX_API_URL=http://localhost:3000
WHATSAPP_SESSION_PATH=.wwebjs_auth
WHATSAPP_CACHE_PATH=.wwebjs_cache
WHATSAPP_RECONNECT_DELAY_MS=5000
WHATSAPP_PUPPETEER_HEADLESS=true
# Test only: also accept group messages sent by the linked account.
WHATSAPP_INCLUDE_SELF_MESSAGES=true
```
