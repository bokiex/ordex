# Ordex - Order Management System

## Project Goal

Parse WhatsApp messages containing customer orders → match against known item codes and debtor records → generate AutoCount-importable Excel files (Invoice format).

## Tech Stack

- TanStack Start (React + SSR)
- Bun runtime
- TypeScript
- HeroUI + Tailwind CSS v4
- Drizzle ORM + better-sqlite3
- xlsx (SheetJS) for Excel parsing/generation
- Biome for linting

## Excel Data Sources (`docs/excel sheets/`)

### 1. `Default Sales.xlsx` - AutoCount Import Templates

Contains header-only templates for all AutoCount sales document types:
- **Sheets:** Quotation, SalesOrder, DeliveryOrder, **Invoice**, CashSale, CreditNote, DebitNote

**Invoice sheet columns (99 cols) - THIS IS THE TARGET IMPORT FORMAT:**

Header-level fields:
- `DocNo`, `DocDate`, `DebtorCode`, `DebtorName`, `Ref`, `Description`
- `DisplayTerm`, `SalesAgent`, `InvAddr1-4`, `Phone1`, `Fax1`, `Attention`
- `BranchCode`, `DeliverAddr1-4`, `DeliverPhone1`, `DeliverFax1`, `DeliverContact`
- `SalesExemptionNo`, `SalesExemptionExpiryDate`
- `Footer1Param/Amt/TaxType`, `Footer2Param/Amt/TaxType`, `Footer3Param/Amt/TaxType`
- `CurrencyCode` (SGD), `CurrencyRate` (1), `Tax`, `PostToStock`, `PostToGL`
- `Transferable`, `Note`, `Remark1-4`, `Cancelled`, `RefDocNo`, `MemberNo`
- `ShipVia`, `ShipInfo`, `SalesLocation`, `Footer1-3Tax`
- `ToTaxCurrencyRate`, `CalcDiscountOnUnitPrice`, `TaxDocNo`, `InclusiveTax`
- `Footer1-3TaxRate`, `TaxDate`, `IsRoundAdj`, `RoundingMethod`, `Numbering`

Line-item fields:
- `ItemCode`, `Location` (HQ), `BatchNo`, `DetailDescription`, `FurtherDescription`
- `YourPONo`, `YourPODate`, `ProjNo`, `DeptNo`
- `UOM`, `UserUOM`, `Qty`, `FOCQty`, `UnitPrice`, `Discount`, `DiscountAmt`
- `TaxType` (SR), `SubTotal`, `BonusPoint`, `DetailTransferable`, `PrintOut`
- `CalcByPercent`, `AddToSubTotal`, `ForConsignment`, `AccNo`
- `OurDONo`, `OurDODate`, `EstimatedDeliveryDate`, `DeliveryDate`
- `TaxableAmt`, `TaxAdjustment`, `TaxExportCountry`, `TaxRate`, `LocalTaxAdjustment`

### 2. `INV DETAIL LISTING.xlsx` - Existing Invoice Records

~1552 invoice line items exported from AutoCount.

| Column | Type | Example |
|--------|------|---------|
| Doc No | string | INV159935 |
| Doc Date | Excel serial | 46052 (= 2026-02-12) |
| Debtor Code | string | 3000-J003 |
| Debtor Name | string | JOS.FK TRADING PTE LTD |
| Agent | string | Self-Pickup, 3779, 136, 9179, 9900 |
| Curr. Code | string | SGD |
| Item Code | string | SFSLALA4060 |
| Detail Description | string | WHITE CLAM LALA 40/60 (500G X 20PKT) |
| UOM | string | CTN, kg, PKT |
| Location | string | HQ |
| Qty | number | 15 |
| Unit Price | number | 40 |
| Tax Code | string | SR |
| Desc2 | string | Customer-specific note (e.g. "Joseph (FROZEN)") |

### 3. `Item Codes 26.2.26.xlsx` - Product Catalog

~187 items with codes and descriptions.

| Column | Type | Example |
|--------|------|---------|
| Item Code | string | SFSLALA4060 |
| Base UOM | string | PKT, CTN, kg, TUBE, BTL |
| UOM Count | number | 1-2 |
| Description | string | WHITE CLAM LALA 40/60 (500G X 20PKT) |
| Item Group | string | Beancurd, Seafood, Sauce, Other, etc. |
| Stock Control | Checked/Unchecked | |
| Is Active | Checked/Unchecked | |
| Total Bal. Qty | number | Ignored; the app stores item pricing instead |

### 4. `debtor listing.xlsx` - Customer Directory

~90 customers (debtors).

| Column | Type | Example |
|--------|------|---------|
| Code | string | 3000-J003 |
| Company Name | string | JOS.FK TRADING PTE LTD |
| 2nd Description | string | Location/alias |
| Debtor Type | string | Category |
| Currency Code | string | SGD |
| Phone 1 | string | Phone number |
| Agent | string | 9179, 9900, 136, etc. |
| Active | Checked/Unchecked | |
| Multi Pricing | string | Price 1 |

## Key Relationships

- **Debtor Code** links `debtor listing` ↔ `INV DETAIL LISTING` ↔ AutoCount Invoice `DebtorCode`
- **Item Code** links `Item Codes` ↔ `INV DETAIL LISTING` ↔ AutoCount Invoice `ItemCode`
- **Agent** codes appear in both debtor listing and invoices
- **UOM** from Item Codes maps to Invoice `UOM` field

## Workflow

1. WhatsApp message arrives via webhook, WhatsApp Web group worker, or manually via `POST /api/orders`
2. AI parser (Ollama) extracts: customer name, items ordered, quantities, UOMs
3. Match customer → debtor code (fuzzy match against Company Name / alias / code)
4. Load customer's item preferences from invoice history (`getDebtorItemPreferences`)
5. Match items → item codes using customer preference (preferred manufacturer first, catalogue fallback)
6. Auto-populate unit prices from most recent invoice history
7. Create draft order → review/edit in UI → confirm → export to AutoCount Excel

## Feature Documentation

Detailed docs for each feature are in `docs/` to reduce codebase traversal:

| Doc | Covers |
|-----|--------|
| `docs/architecture.md` | Directory structure, tech stack, config files, env vars, scripts |
| `docs/whatsapp-webhook.md` | WhatsApp types, `extractTextMessages()`, mock payloads, webhook → order creation |
| `docs/whatsapp-group-worker.md` | `whatsapp-web.js` group worker, env vars, QR auth, worker lifecycle |
| `docs/ai-order-parser.md` | Ollama integration, prompt template, `ParsedOrder` types, validation |
| `docs/item-matcher.md` | Customer preference matching, `matchItem()`, `getDebtorItemPreferences()` |
| `docs/database.md` | All 5 table schemas, relationships, seed script, migration commands |
| `docs/api-routes.md` | All API endpoints with request/response shapes |
| `docs/frontend.md` | Route structure, components, UI libraries, styling setup |
| `docs/testing.md` | Test coverage (41 tests), patterns, how to add tests |
| `docs/test-examples.md` | Curl commands for testing order creation with real customer data |

**Read these docs first before traversing `src/` — they contain file locations, type definitions, function signatures, and implementation details.**

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite dev --port 3000` | Start dev server |
| `build` | `vite build` | Production build |
| `test` | `vitest run` | Run all tests |
| `lint` | `biome check --write ...` | Lint & format |
| `whatsapp:start` | `bun run src/workers/whatsapp-group/index.ts` | Start WhatsApp group worker |
| `whatsapp:dev` | `bun run --watch src/workers/whatsapp-group/index.ts` | Start worker in watch mode |
| `db:generate` | `drizzle-kit generate` | Generate migrations |
| `db:migrate` | `drizzle-kit migrate` | Apply migrations |
| `db:push` | `drizzle-kit push` | Push schema directly |
| `db:seed` | `bun run src/db/seed.ts` | Seed DB from Excel |

- `scripts/parse-excel.ts` - Dumps structure and sample data from all Excel files (run with `bun run scripts/parse-excel.ts`)

## Development Rules

- Code must build (`bun run build`) and pass tests (`bun run test`) before committing
- Write unit tests for all new modules
- Commit after each completed Linear issue
- Use TanStack Start `server.handlers` for API routes (not `createServerFn` for webhooks)
- Biome linter runs on pre-commit via lefthook; auto-generated files excluded via `overrides`
- **Always update docs on any code change.** When you modify, add, or remove files/features/APIs, update the relevant `docs/*.md` files and the feature docs table below in CLAUDE.md. Docs must always reflect the current state of the codebase. This is not optional.

## UI Component Rules

- **Always use HeroUI components** — never use raw HTML for interactive elements (buttons, inputs, modals, tables, navigation, drawers, chips, etc.)
- Import from `@heroui/react` — do not create custom components when HeroUI provides an equivalent
- Use HeroUI's `classNames` prop for styling overrides, not wrapper divs with Tailwind
- Icons: use Lucide React (`lucide-react`) for all icons
- Layout: Tailwind CSS utility classes for spacing/grid/flex; HeroUI components for interactive UI

## API Routes

- `GET/POST /api/webhook/whatsapp` — WhatsApp webhook (verification + message → AI parse → order creation)
- `POST /api/parse-order` — Standalone AI parser via Ollama (no order creation)
- `GET/POST /api/orders` — List orders / Create order from message (AI parse + preference matching)
- `GET/PUT/DELETE /api/orders/:id` — Single order CRUD
- `POST /api/orders/:id/confirm` — Confirm a draft order
- `POST /api/orders/:id/items` — Add line item to order
- `PUT/DELETE /api/order-items/:id` — Update/delete line item
- `GET /api/debtors` — List/search debtors
- `GET /api/items` — List/search items

See `docs/api-routes.md` for full request/response schemas.

## Key Modules

- `src/lib/whatsapp/` — WhatsApp Cloud API types, mock payloads, message extraction → see `docs/whatsapp-webhook.md`
- `src/workers/whatsapp-group/` — `whatsapp-web.js` group worker, session config, message forwarding → see `docs/whatsapp-group-worker.md`
- `src/lib/parser/` — AI order parser (Ollama client, prompt template, validation) → see `docs/ai-order-parser.md`
- `src/lib/matcher/` — Customer preference item matching from invoice history → see `docs/item-matcher.md`
- `src/lib/db/` — DB query functions (orders, items, debtors, invoices) → see `docs/database.md`
- `src/db/` — Database schema (5 tables), connection, seed script → see `docs/database.md`

## Linear Sync Rule

**After any Linear issue is created, updated, or its status/title changes, you MUST:**
1. Fetch the latest state of all project issues via the Linear MCP tool
2. Rewrite the "Linear Project Status" table below to reflect current reality
3. Update the `(Updated YYYY-MM-DD)` date stamp to today's date

Do this automatically — do not wait to be asked.

---

## Linear Project Status (Updated 2026-03-05)

**Project:** Ordex POC - WhatsApp Order Automation
**Team:** Ordex | **Status:** In Progress | **Target:** 2026-03-21

### Completed

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| ORD-5 | Tech Stack Decision | High | **Done** |
| ORD-12 | Environment Setup | Urgent | **Done** |
| ORD-11 | Database Schema (Drizzle) | High | **Done** |
| ORD-6 | WhatsApp Integration (Mock) | High | **Done** |
| ORD-7 | AI Order Parser (Ollama) | High | **Done** |
| ORD-8 | Product Catalogue (DB) | Medium | **Done** |
| ORD-9 | Order Management UI | Medium | **Done** |
| ORD-13 | Item Preference Matcher | High | **Done** |

### In Progress / Upcoming

| Issue | Title | Priority | Status | Due | Notes |
|-------|-------|----------|--------|-----|-------|
| ORD-14 | Excel Export — AutoCount Invoice | High | **Todo** | Mar 10 | POC-critical: generates importable xlsx |
| ORD-16 | Deployment — Production Hosting | Medium | Backlog | Mar 17 | VPS + SSL + Ollama |
| ORD-15 | WhatsApp Cloud API — Live Integration | Medium | Backlog | Mar 21 | Blocked by ORD-16 |
| ORD-17 | Multi-UOM Conversion | Low | Backlog | Mar 21 | CTN↔PKT↔KG handling |
| ORD-18 | Order Audit Log | Low | Backlog | Mar 21 | Nice-to-have for POC |

### Canceled

| Issue | Title | Reason |
|-------|-------|--------|
| ORD-10 | Excel Export (old) | Duplicate of ORD-14 |

**Next up:** ORD-14 (Excel Export) → ORD-16 (Deploy) → ORD-15 (Live WhatsApp)
