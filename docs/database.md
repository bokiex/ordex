# Database Schema & Operations

**Status:** Schema done, seed done, migration applied
**Location:** `src/db/`

## Overview

SQLite database via Drizzle ORM + better-sqlite3. WAL mode enabled, foreign keys enforced. DB file: `ordex.db` (gitignored).

## Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | All 5 table definitions |
| `src/db/index.ts` | DB connection (WAL mode, FK enabled) |
| `src/db/seed.ts` | Excel → DB seeder |
| `drizzle.config.ts` | Drizzle ORM config |
| `drizzle/0000_right_revanche.sql` | Initial migration |

## Connection (`src/db/index.ts`)

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
// WAL mode + foreign keys enabled on connection
```

## Tables

### `items` — Product Catalogue (~187 records from Excel)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `code` | TEXT | PK | e.g. `SFSLALA4060` |
| `description` | TEXT | NOT NULL | e.g. `WHITE CLAM LALA 40/60 (500G X 20PKT)` |
| `base_uom` | TEXT | NOT NULL | PKT, CTN, kg, TUBE, BTL |
| `uom_count` | INTEGER | default 1 | |
| `item_group` | TEXT | — | Beancurd, Seafood, Sauce, Other |
| `is_active` | INTEGER | default 1 | Boolean |
| `stock_balance` | REAL | — | Current stock qty |

### `debtors` — Customer Directory (~90 records from Excel)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `code` | TEXT | PK | e.g. `3000-J003` |
| `company_name` | TEXT | NOT NULL | |
| `alias` | TEXT | — | 2nd Description / location |
| `phone` | TEXT | — | |
| `agent` | TEXT | — | Agent code e.g. `9179` |
| `currency_code` | TEXT | default `SGD` | |
| `is_active` | INTEGER | default 1 | Boolean |
| `multi_pricing` | TEXT | — | e.g. `Price 1` |

### `invoice_history` — Historical Invoice Lines (~1552 from Excel)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK AUTO | |
| `doc_no` | TEXT | NOT NULL | e.g. `INV159935` |
| `doc_date` | TEXT | NOT NULL | ISO date string |
| `debtor_code` | TEXT | NOT NULL | No FK (may have unlisted debtors) |
| `debtor_name` | TEXT | NOT NULL | |
| `agent` | TEXT | — | |
| `item_code` | TEXT | NOT NULL | No FK (may have unlisted items) |
| `description` | TEXT | NOT NULL | |
| `uom` | TEXT | NOT NULL | |
| `location` | TEXT | default `HQ` | |
| `qty` | REAL | NOT NULL | |
| `unit_price` | REAL | NOT NULL | |
| `discount` | TEXT | — | |
| `line_total` | REAL | — | Subtotal ex tax |
| `tax_code` | TEXT | default `SR` | |
| `tax_amount` | REAL | — | |
| `total_inc` | REAL | — | Total inc. tax |
| `desc2` | TEXT | — | Customer-specific note |

### `orders` — WhatsApp-Sourced Orders

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK AUTO | |
| `debtor_code` | TEXT | FK → debtors.code | Nullable (before matching) |
| `debtor_name` | TEXT | — | Raw WhatsApp name |
| `agent` | TEXT | — | |
| `doc_date` | TEXT | NOT NULL | ISO date |
| `raw_message` | TEXT | NOT NULL | Original WhatsApp text |
| `status` | TEXT | NOT NULL, default `draft` | `draft` / `confirmed` / `exported` |
| `created_at` | TEXT | NOT NULL | ISO timestamp, auto-set |

### `order_items` — Order Line Items

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK AUTO | |
| `order_id` | INTEGER | NOT NULL, FK → orders.id | |
| `item_code` | TEXT | FK → items.code | Nullable (before matching) |
| `raw_item_name` | TEXT | — | Original WhatsApp text |
| `description` | TEXT | — | |
| `uom` | TEXT | — | |
| `qty` | REAL | NOT NULL | |
| `unit_price` | REAL | — | |
| `line_total` | REAL | — | |
| `matched` | INTEGER | default 0 | Boolean: was fuzzy-matched? |

## Key Relationships

```
debtors.code ←── orders.debtor_code
items.code   ←── order_items.item_code
orders.id    ←── order_items.order_id
```

`invoice_history` intentionally has no FKs — it may reference debtors/items not in the current catalogue.

## Seed Script (`src/db/seed.ts`)

Run: `bun run db:seed`

1. Reads `Item Codes 26.2.26.xlsx` → inserts into `items`
2. Reads `debtor listing.xlsx` → inserts into `debtors`
3. Reads `INV DETAIL LISTING.xlsx` → inserts into `invoice_history` (500-row batches)
4. Converts Excel serial dates to ISO strings
5. Uses `onConflictDoNothing()` — safe to re-run

## Migration Commands

```bash
bun run db:generate   # Generate migration from schema changes
bun run db:migrate    # Apply pending migrations
bun run db:push       # Push schema directly (dev shortcut)
bun run db:studio     # Open Drizzle Studio GUI
```
