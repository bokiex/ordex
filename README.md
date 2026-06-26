# Ordex

Ordex turns WhatsApp customer order messages into reviewable draft orders. Incoming text messages are stored first, grouped by customer in the Orders page, and only sent to AI when a user selects the relevant message fragments and clicks **Generate order**.

## Prerequisites

- Node.js 22
- pnpm 10
- Bun, used by the database seed script and WhatsApp group worker
- SQLite, via `better-sqlite3`
- Ollama running locally for AI order generation

The default parser expects Ollama at `http://localhost:11434` with model `qwen2.5:7b`.

## Install

```bash
pnpm install
```

## Database

The app uses `ordex.db` in the project root by default.

Apply migrations:

```bash
pnpm db:migrate
```

Seed reference data from the Excel files in `docs/excel sheets/`:

```bash
pnpm db:seed
```

Useful database commands:

```bash
pnpm db:generate
pnpm db:push
pnpm db:studio
```

## Run The Web App

Start the TanStack Start dev server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

### Run Locally In Production

Build the app, then start the production web server and WhatsApp group worker
together:

```bash
pnpm build
pnpm start
```

`pnpm start` loads `.env` followed by `.env.local`, starts the generated Nitro
server, and starts the WhatsApp worker. If either process stops, the other is
shut down as well.

To run the processes independently:

```bash
pnpm start:web
pnpm start:whatsapp
```

The production build must already exist at `.output/server/index.mjs`. Database
migrations remain an explicit setup step:

```bash
pnpm db:migrate
```

The main workflow is in **Orders**:

- **Incoming Messages** shows raw WhatsApp messages grouped by sender/customer.
- Select one or more messages from the same sender.
- Click **Generate order** to combine those fragments, parse them with AI, and create a draft order.
- The generated draft opens in the order detail modal for review and correction.

The page listens to `GET /api/events/incoming-messages` with Server-Sent Events, so newly received messages should appear without a hard refresh. A polling fallback also refreshes the page periodically.

## WhatsApp Inputs

Ordex supports two receive paths.

### Meta Cloud API Webhook

Configure Meta to call:

```text
GET/POST /api/webhook/whatsapp
```

Set the verification token with:

```bash
WHATSAPP_VERIFY_TOKEN=ordex-dev-token
```

Webhook text messages are stored in `incoming_messages`; they do not create orders immediately.

### WhatsApp Group Worker

For shared WhatsApp groups, run the worker in a second terminal after the web app is running:

```bash
pnpm whatsapp:start
```

For development with watch mode:

```bash
pnpm whatsapp:dev
```

On first startup, scan the QR code printed in the terminal. The worker forwards group messages to `POST /api/incoming-messages`, where they are stored for review.

Common worker environment variables:

```bash
ORDEX_API_URL=http://localhost:3000
WHATSAPP_SESSION_PATH=.wwebjs_auth
WHATSAPP_CACHE_PATH=.wwebjs_cache
WHATSAPP_RECONNECT_DELAY_MS=5000
WHATSAPP_PUPPETEER_HEADLESS=true
WHATSAPP_CHROME_EXECUTABLE_PATH=/path/to/chrome
```

## Build And Test

Run tests:

```bash
pnpm test
```

Build for production:

```bash
pnpm build
```

Preview a production build:

```bash
pnpm preview
```

## Documentation

- `docs/architecture.md` — project structure and message flow
- `docs/database.md` — schema and migrations
- `docs/api-routes.md` — API endpoint behavior
- `docs/frontend.md` — UI routes and patterns
- `docs/whatsapp-webhook.md` — Meta webhook integration
- `docs/whatsapp-group-worker.md` — WhatsApp Web worker setup
- `docs/ai-order-parser.md` — AI parser behavior
- `docs/item-matcher.md` — customer-history item matching
- `docs/test-examples.md` — curl examples
