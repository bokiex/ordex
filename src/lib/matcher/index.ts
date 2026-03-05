/**
 * Item matching with customer preference from invoice history.
 *
 * When a customer orders "lala", we check their invoice history first
 * to find which specific lala product (manufacturer) they usually buy.
 * Falls back to generic catalogue search if no history exists.
 */

import type { DebtorItemPreference } from "@/lib/db/invoices";
import { searchItems } from "@/lib/db/items";
import { normalizeUom } from "@/lib/uom";

export type MatchResult = {
	itemCode: string;
	description: string;
	uom: string;
	unitPrice: number | null;
	matched: true;
	source: "history" | "catalogue";
};

/**
 * Match a parsed item name to a product code, preferring customer history.
 *
 * Strategy:
 * 1. Search the customer's invoice history preferences for a fuzzy match
 * 2. If found, use that item code (the customer's preferred manufacturer)
 * 3. If not found, fall back to generic catalogue search
 *
 * Returns null if no match found anywhere.
 */
export function matchItem(
	itemName: string,
	preferences: DebtorItemPreference[],
): MatchResult | null {
	// 1. Try matching against customer's historical purchases
	const historyMatch = findBestPreference(itemName, preferences);
	if (historyMatch) {
		return {
			itemCode: historyMatch.itemCode,
			description: historyMatch.description,
			uom: normalizeUom(historyMatch.uom),
			unitPrice: historyMatch.lastUnitPrice,
			matched: true,
			source: "history",
		};
	}

	// 2. Fall back to generic catalogue search
	const catalogueMatches = searchItems(itemName);
	if (catalogueMatches.length > 0) {
		const best = catalogueMatches[0];
		return {
			itemCode: best.code,
			description: best.description,
			uom: normalizeUom(best.baseUom),
			unitPrice: null,
			matched: true,
			source: "catalogue",
		};
	}

	return null;
}

/**
 * Find the best matching preference from a customer's invoice history.
 *
 * Tokenizes the item name and scores each preference by how many tokens
 * appear in the preference's description or item code. Preferences are
 * already sorted by order frequency (most ordered first), so ties are
 * broken by purchase frequency.
 */
function findBestPreference(
	itemName: string,
	preferences: DebtorItemPreference[],
): DebtorItemPreference | null {
	if (preferences.length === 0) return null;

	const tokens = tokenize(itemName);
	if (tokens.length === 0) return null;

	let bestMatch: DebtorItemPreference | null = null;
	let bestScore = 0;

	for (const pref of preferences) {
		const target = `${pref.itemCode} ${pref.description}`.toLowerCase();
		let score = 0;

		for (const token of tokens) {
			if (target.includes(token)) {
				score++;
			}
		}

		// Require at least 1 token match
		if (score > bestScore) {
			bestScore = score;
			bestMatch = pref;
		}
	}

	return bestMatch;
}

/** Tokenize a string into lowercase words, filtering out noise. */
function tokenize(text: string): string[] {
	const noise = new Set([
		"x",
		"pkt",
		"ctn",
		"kg",
		"pc",
		"pcs",
		"tube",
		"btl",
		"the",
		"a",
		"an",
		"of",
		"and",
	]);

	return text
		.toLowerCase()
		.replace(/[^a-z0-9/\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length > 1 && !noise.has(t));
}

// Exported for testing
export { findBestPreference as _findBestPreference, tokenize as _tokenize };
