# Frontend

## Route Structure

```
__root__  (src/routes/__root.tsx)
│   HTML shell, <head>, <body>, <Header />, <HeroUIProvider>, TanStack devtools
│
├── /           (src/routes/index.tsx)        — Dashboard / homepage
├── /orders     (src/routes/orders.tsx)       — Order list + detail modal
├── /customers  (src/routes/customers.tsx)    — Customer (debtor) listing
├── /items      (src/routes/items.tsx)        — Item catalogue
└── /invoices   (src/routes/invoices.tsx)     — Invoice history
```

## Components

### Orders

| Component | File | Purpose |
|-----------|------|---------|
| `OrderDetailModal` | `src/components/orders/OrderDetailModal.tsx` | Full order view/edit modal with customer autocomplete, item matching, qty/price editing |

Order creation is API-only (via `POST /api/orders` or WhatsApp webhook). The orders page displays and manages existing orders.

### Shared

| Component | File | Purpose |
|-----------|------|---------|
| `Header` | `src/components/Header.tsx` | Dark top bar with hamburger sidebar nav |
| `PageHeader` | `src/components/shared/PageHeader.tsx` | Page title component |
| `StatusChip` | `src/components/shared/StatusChip.tsx` | Order status badge |
| `ConfirmDeleteModal` | `src/components/shared/ConfirmDeleteModal.tsx` | Delete confirmation dialog |

## Key Patterns

### Client-Side Search
The `OrderDetailModal` loads all debtors and items once when opened, then filters client-side via `useMemo`. This eliminates debounce + server round-trips for the ~90 debtors and ~187 items.

### Autocomplete Selection Display
Customer and item autocomplete fields update their displayed text on selection (not just the hidden key). Customer shows `"CODE — NAME"` format.

## Styling

### `src/styles.css`
- Tailwind CSS v4 with `@import "tailwindcss"`
- HeroUI plugin via `@plugin "./hero"` (references `src/hero.ts`)

### `src/hero.ts`
- Exports HeroUI Tailwind plugin with `addCommonColors: true`

## UI Libraries

| Library | Version | Status |
|---------|---------|--------|
| HeroUI | 2.8.9 | Installed, provider wired in `__root__` |
| Framer Motion | 12.34.4 | Installed, used in Header sidebar |
| Lucide React | 0.545.0 | Installed, used for icons |
| Tailwind CSS v4 | 4.1.18 | Configured |

## Dev Server
```bash
bun run dev  # Starts on port 3000
```
