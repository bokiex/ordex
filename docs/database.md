# Database Schema & Operations

**Status:** Schema done, seed done, migration applied
**Location:** `src/db/`

## Overview

SQLite database via Drizzle ORM + better-sqlite3. WAL mode enabled, foreign keys enforced. DB file: `ordex.db` (gitignored).

## Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | All 6 table definitions |
| `src/db/index.ts` | DB connection (WAL mode, FK enabled, compatibility bootstrap for `incoming_messages`) |
| `src/db/seed.ts` | Excel → DB seeder |
| `drizzle.config.ts` | Drizzle ORM config |
| `drizzle/0000_right_revanche.sql` | Initial migration |
| `drizzle/0001_daily_kang.sql` | Adds `incoming_messages` |
| `drizzle/0005_clammy_elektra.sql` | Adds nullable source-qualified conversation identity |

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
| `price` | REAL | — | Latest known catalogue price from invoice history |

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

### `incoming_messages` — Raw WhatsApp Messages Awaiting Review

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK AUTO | |
| `from` | TEXT | NOT NULL | Sender phone/id |
| `sender_name` | TEXT | NOT NULL | WhatsApp contact/group-worker display name |
| `customer_name_hint` | TEXT | nullable | WhatsApp group name used for customer matching |
| `conversation_key` | TEXT | nullable | Source-qualified group or Meta conversation; legacy/unknown messages remain null and are isolated |
| `whatsapp_message_id` | TEXT | NOT NULL, UNIQUE | Deduplicates webhook/worker deliveries |
| `timestamp` | TEXT | NOT NULL | WhatsApp timestamp string |
| `body` | TEXT | NOT NULL | Raw message body |
| `status` | TEXT | NOT NULL, default `new` | `new` / `used` |
| `source_order_id` | INTEGER | FK → orders.id | Set after selected messages generate an order |
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
orders.id    ←── incoming_messages.source_order_id
items.code   ←── order_items.item_code
orders.id    ←── order_items.order_id
```

`invoice_history` intentionally has no FKs — it may reference debtors/items not in the current catalogue.

## Seed Script (`src/db/seed.ts`)

For a fresh database, apply migrations first, then seed:

```bash
pnpm db:migrate
pnpm db:seed
```

`db:seed` runs with Node and the `tsx` loader because the Drizzle `better-sqlite3` driver requires Node's native-addon support; it cannot run under Bun.

1. Reads `Item Codes 26.2.26.xlsx` → inserts into `items`, using the latest invoice-history price for each matching item code
2. Reads `debtor listing.xlsx` → inserts into `debtors`
3. Reads `INV DETAIL LISTING.xlsx` → inserts into `invoice_history` (500-row batches)
4. Converts Excel serial dates to ISO strings
5. Uses `onConflictDoNothing()` for `items` and `debtors`. Invoice-history rows are appended, so seed only a new database unless you intentionally want duplicate history rows.

## Migration Commands

```bash
pnpm db:generate   # Generate migration from schema changes
pnpm db:migrate    # Apply pending migrations
pnpm db:push       # Push schema directly (dev shortcut)
pnpm db:studio     # Open Drizzle Studio GUI
```
