# Frontend

## Route Structure

```
__root__  (src/routes/__root.tsx)
│   HTML shell, <head>, <body>, <Header />, <HeroUIProvider>, TanStack devtools
│
├── /           (src/routes/index.tsx)        — Dashboard / homepage
├── /orders     (src/routes/orders.tsx)       — Incoming messages, order list + detail modal
├── /customers  (src/routes/customers.tsx)    — Customer (debtor) listing
├── /items      (src/routes/items.tsx)        — Item catalogue
└── /invoices   (src/routes/invoices.tsx)     — Invoice history
```

## Components

### Orders

| Component | File | Purpose |
|-----------|------|---------|
| `OrderDetailModal` | `src/components/orders/OrderDetailModal.tsx` | Full order view/edit modal with customer autocomplete, item matching, qty/price editing |

The Orders page has three tabs:

| Tab | Purpose |
|-----|---------|
| `Orders` | Draft orders generated from selected incoming messages |
| `Incoming Messages` | Raw WhatsApp messages grouped by sender/customer; supports multi-select and AI order generation |
| `Confirmed` | Confirmed/exported orders |

Incoming messages are grouped by stable sender id (`from`). Users can select one or more messages from the same sender and click **Generate order**. The UI sends selected `messageIds` to `POST /api/incoming-messages`, opens the generated draft order in `OrderDetailModal`, and refreshes both order and incoming-message lists.

The page also opens an `EventSource` to `GET /api/events/incoming-messages`. When an `incoming-message` event arrives, it refetches `/api/incoming-messages?status=new` so new WhatsApp messages appear without a hard refresh. A 10s polling fallback still refreshes orders and incoming messages.

### Shared

| Component | File | Purpose |
|-----------|------|---------|
| `Header` | `src/components/Header.tsx` | HeroUI Navbar — mobile-only top bar with menu toggle |
| `Sidebar` | `src/components/Sidebar.tsx` | HeroUI Drawer (mobile) + Listbox navigation (desktop fixed) |
| `PageHeader` | `src/components/shared/PageHeader.tsx` | Page title component |
| `StatusChip` | `src/components/shared/StatusChip.tsx` | Order status badge |
| `ConfirmDeleteModal` | `src/components/shared/ConfirmDeleteModal.tsx` | Delete confirmation dialog |

## Key Patterns

### Client-Side Search
The `OrderDetailModal` loads all debtors and items once when opened, then filters client-side via `useMemo`. This eliminates debounce + server round-trips for the ~90 debtors and ~187 items.

### Incoming Message Selection
HeroUI table selection keys are stored as strings in `orders.tsx`. Message IDs are converted back to numbers only when posting `{ messageIds }` to the API. This avoids checkbox drift between grouped tables.

### Live Refresh
`orders.tsx` uses browser-native Server-Sent Events:

```typescript
const events = new EventSource("/api/events/incoming-messages");
events.addEventListener("incoming-message", () => refetchIncomingMessages());
```

The SSE connection is one-way server-to-browser. The browser handles transient reconnects automatically.

### Autocomplete Selection Display
Customer and item autocomplete fields update their displayed text on selection (not just the hidden key). Customer shows `"CODE — NAME"` format.

## UI Rules

- **Always use HeroUI components** — never raw HTML for interactive elements (buttons, inputs, modals, tables, navigation, drawers, chips)
- Import from `@heroui/react`
- Use `classNames` prop for styling overrides
- Icons: Lucide React (`lucide-react`)
- Layout: Tailwind CSS utilities for spacing/grid/flex; HeroUI for interactive UI

## Styling

HeroUI components are the primary building blocks for all interactive UI. Raw HTML elements should only be used for layout containers (`div`, `section`, `main`).

### `src/styles.css`
- Tailwind CSS v4 with `@import "tailwindcss"`
- HeroUI plugin via `@plugin "./hero"` (references `src/hero.ts`)

### `src/hero.ts`
- Exports HeroUI Tailwind plugin with `addCommonColors: true`

## UI Libraries

| Library | Version | Status |
|---------|---------|--------|
| HeroUI | 2.8.9 | Installed, provider wired in `__root__` |
| Framer Motion | 12.34.4 | Installed, used by HeroUI internally |
| Lucide React | 0.545.0 | Installed, used for icons |
| Tailwind CSS v4 | 4.1.18 | Configured |

## Dev Server
```bash
bun run dev  # Starts on port 3000
```
