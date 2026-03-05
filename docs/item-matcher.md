# Item Matcher — Customer Preference Matching

**Status:** Done
**Location:** `src/lib/matcher/`

## Overview

When multiple manufacturers produce the same product (e.g., 5 different bee hoon manufacturers), the matcher uses a customer's invoice history to pick the item code they historically buy. Falls back to generic catalogue search for unknown customers.

## Files

| File | Purpose |
|------|---------|
| `src/lib/matcher/index.ts` | `matchItem()`, `filterItems()`, `tokenize()` |
| `src/lib/matcher/__tests__/matcher.test.ts` | 13 unit tests |
| `src/lib/db/invoices.ts` | `getDebtorItemPreferences()` — DB query |

## How It Works

### Matching Strategy

```
1. Tokenize item name ("kway teow medium" → ["kway", "teow", "medium"])
2. Score each preference by token overlap with description/code
3. Pick the highest-scoring preference (ties broken by purchase frequency)
4. If no preference matches → fall back to generic catalogue LIKE search
```

### Key Function: `matchItem(itemName, preferences)`

```typescript
matchItem(
  itemName: string,           // e.g. "bee hoon"
  preferences: DebtorItemPreference[]  // from getDebtorItemPreferences()
): MatchResult | null

// Returns:
{
  itemCode: string;       // e.g. "HOCKHIN BEEHOON"
  description: string;    // e.g. "Bee Hoon (3kg) 米粉"
  uom: string;            // e.g. "PKT"
  unitPrice: number|null; // from most recent invoice
  matched: true;
  source: "history" | "catalogue";  // where the match came from
}
```

### Key Function: `getDebtorItemPreferences(debtorCode)`

```typescript
// Returns all item codes this customer has ordered, ranked by frequency
getDebtorItemPreferences(debtorCode: string): DebtorItemPreference[]

// Each entry:
{
  itemCode: string;      // e.g. "HOCKHIN BEEHOON"
  description: string;   // e.g. "Bee Hoon (3kg) 米粉"
  uom: string;           // e.g. "PKT"
  lastUnitPrice: number; // from most recent invoice for this item+debtor
  orderCount: number;    // how many times this item was ordered
}
```

## Example: Why This Matters

The `items` table has 5 different bee hoon products:

| Code | Manufacturer |
|------|-------------|
| `ENGBEE BEEHOON` | Eng Bee |
| `HOCKHIN BEEHOON` | Hock Hin |
| `NVBEHOO3KG` | NV |
| `REN MING BEEHOON` | Ren Ming |
| `TAISUN BEEHOON` | Tai Sun |

All have the same description: "Bee Hoon (3kg) 米粉"

Without preferences, `searchItems("bee hoon")` returns whichever is first alphabetically. With preferences, customer A gets HOCKHIN and customer B gets ENGBEE based on their purchase history.

## Integration Points

### POST /api/orders (order creation)
1. Customer matched → `debtorCode` resolved
2. `getDebtorItemPreferences(debtorCode)` loads history
3. Each parsed item runs through `matchItem(name, preferences)`
4. Results include `unitPrice` from history

### POST /api/webhook/whatsapp (webhook)
Same flow as above, triggered automatically from incoming WhatsApp messages.

## Tests (13)

| # | Test | Validates |
|---|------|-----------|
| 1-4 | tokenize() | Splitting, noise filtering, slash-numbers, empty input |
| 5-10 | findBestPreference() | Lala → 40/60, specific size, sotong, noodle, no match, empty prefs |
| 11-13 | matchItem() | History source + price, specific match, fallback behavior |
