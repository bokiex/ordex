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

1. Parse WhatsApp messages to extract: customer name, items ordered, quantities
2. Match customer → debtor code (fuzzy match against Company Name / 2nd Description)
3. Match items → item codes (fuzzy match against Description / Item Code)
4. Look up pricing from historical invoices (INV DETAIL LISTING)
5. Generate AutoCount Invoice-format Excel for import

## Scripts

- `scripts/parse-excel.ts` - Dumps structure and sample data from all Excel files (run with `bun run scripts/parse-excel.ts`)

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
| ORD-12 | Environment Setup | Urgent | **In Progress** | Packages + .env + drizzle.config done; needs schema + migrations + seed |
| ORD-11 | Database Schema (Drizzle) | High | Backlog | Blocked on ORD-12 completion |
| ORD-6 | WhatsApp Integration (Mock) | High | Backlog | No API routes yet |
| ORD-7 | AI Order Parser (Ollama) | High | Backlog | Use qwen2.5:7b via Ollama REST API |
| ORD-8 | Product Catalogue (DB) | Medium | Backlog | Excel data parsed, needs DB tables + seed |
| ORD-9 | Order Parser UI | Medium | Backlog | HeroUI ready, only placeholder route |
| ORD-10 | Excel Export (Invoice) | High | Backlog | SheetJS installed, no export logic |

**Implementation order:** ORD-12 (finish) → ORD-11 → ORD-8 → ORD-7 → ORD-6 → ORD-9 → ORD-10
