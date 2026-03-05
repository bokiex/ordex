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
| Total Bal. Qty | number | Current stock balance |

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

1. WhatsApp message arrives via webhook (or manually via `POST /api/orders`)
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
| `docs/ai-order-parser.md` | Ollama integration, prompt template, `ParsedOrder` types, validation |
| `docs/item-matcher.md` | Customer preference matching, `matchItem()`, `getDebtorItemPreferences()` |
| `docs/database.md` | All 5 table schemas, relationships, seed script, migration commands |
| `docs/api-routes.md` | All API endpoints with request/response shapes |
| `docs/frontend.md` | Route structure, components, UI libraries, styling setup |
| `docs/testing.md` | Test coverage (30 tests), patterns, how to add tests |
| `docs/test-examples.md` | Curl commands for testing order creation with real customer data |

**Read these docs first before traversing `src/` — they contain file locations, type definitions, function signatures, and implementation details.**

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite dev --port 3000` | Start dev server |
| `build` | `vite build` | Production build |
| `test` | `vitest run` | Run all tests |
| `lint` | `biome check --write ...` | Lint & format |
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

## Linear Project Status (Updated 2026-03-03)

**Project:** Ordex POC - WhatsApp Order Automation
**Team:** Ordex | **Target:** 2026-03-01 (overdue)

| Issue | Title | Priority | Status | Notes |
|-------|-------|----------|--------|-------|
| ORD-5 | Tech Stack Decision | High | **Done** | All deps installed, configs in place |
| ORD-12 | Environment Setup | Urgent | **Done** | Packages + .env + drizzle.config + schema + migrations + seed all complete |
| ORD-11 | Database Schema (Drizzle) | High | **Done** | 5 tables defined, migration applied, seed script working |
| ORD-6 | WhatsApp Integration (Mock) | High | **Done** | Webhook GET/POST, types, mock payloads, 7 tests |
| ORD-7 | AI Order Parser (Ollama) | High | **Done** | Ollama client, prompt, validation, 10 tests |
| ORD-8 | Product Catalogue (DB) | Medium | Backlog | Excel data parsed, needs DB tables + seed |
| ORD-9 | Order Parser UI | Medium | Backlog | HeroUI ready, only placeholder route |
| ORD-10 | Excel Export (Invoice) | High | Backlog | SheetJS installed, no export logic |

**Implementation order:** ORD-12 (finish) → ORD-11 → ORD-8 → ORD-7 → ORD-6 → ORD-9 → ORD-10
