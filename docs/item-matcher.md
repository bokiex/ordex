# Item Matcher — Customer Preference Matching

**Status:** Done
**Location:** `src/lib/matcher/`

## Overview

When multiple manufacturers produce the same product (e.g., 5 different bee hoon manufacturers), the matcher uses a customer's invoice history to pick the active item code they historically buy. It otherwise ranks every active catalogue item and always returns the best candidate when the catalogue is non-empty.

## Files

| File | Purpose |
|------|---------|
| `src/lib/matcher/index.ts` | `matchItem()`, `filterItems()`, `tokenize()` |
| `src/lib/matcher/__tests__/matcher.test.ts` | Matcher unit tests |
| `src/lib/db/invoices.ts` | `getDebtorItemPreferences()` — DB query |

## How It Works

### Matching Strategy

```
1. Tokenize item name ("kway teow medium" → ["kway", "teow", "medium"])
2. Score customer preferences using exact tokens, size/grade numbers, compact names, and minor spelling differences
3. Use the best historical preference only if its code still exists in the active catalogue
4. Otherwise rank every active catalogue item with the same scoring rules
5. Return the highest-ranked catalogue candidate, including for a zero-confidence query
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
  unitPrice: number|null; // customer history price, or stored catalogue price
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

With preferences, customer A gets HOCKHIN and customer B gets ENGBEE based on their purchase history. Without preferences, all active catalogue candidates are ranked rather than relying on a whole-phrase SQL `LIKE` match.

## Integration Points

### POST /api/orders (order creation)
1. Customer matched → `debtorCode` resolved
2. `getDebtorItemPreferences(debtorCode)` loads history
3. Each parsed item runs through `matchItem(name, preferences)`
4. Results include the customer's latest historical price, falling back to the stored catalogue price

Manually selected or added catalogue items also copy their stored price into the
order line. Existing lines with no saved unit price display the current catalogue
price when one is available.

### POST /api/webhook/whatsapp (webhook)
Same flow as above, triggered automatically from incoming WhatsApp messages.

## Tests

| # | Test | Validates |
|---|------|-----------|
| 1-4 | tokenize() | Splitting, noise filtering, slash-numbers, empty input |
| 5-10 | findBestPreference() | Lala → 40/60, specific size, sotong, noodle, no match, empty prefs |
| Matcher tests | `matchItem()` | History source + price, specific sizes, reordered words, misspellings, inactive historical codes, and fallback behavior |
