/**
 * Item matching against active catalogue descriptions.
 *
 * The AI parser extracts the buyer's wording. Matching should then choose the
 * catalogue row whose description best matches those words. Customer history is
 * used only as a tie-breaker among equally good description matches because
 * item codes can contain legacy/vendor wording that contradicts the description.
 */

import type { DebtorItemPreference } from "@/lib/db/invoices";
import { listItems } from "@/lib/db/items";
import type { Item } from "@/lib/db/types";
import {
	getTextMatch,
	rankCatalogueItemsByDescription,
	scoreTextMatch,
	tokenizeSearchText,
} from "@/lib/itemSearch";
import { normalizeUom } from "@/lib/uom";

export type MatchResult = {
	itemCode: string;
	description: string;
	uom: string;
	unitPrice: number | null;
	matched: true;
	source: "history" | "catalogue";
};

type PreferenceMatch = {
	preference: DebtorItemPreference;
	score: number;
	matchedMeaningfulTokens: number;
};

/**
 * Match a parsed item name to a product code by catalogue description.
 *
 * Returns null if no match found anywhere.
 */
export function matchItem(
	itemName: string,
	preferences: DebtorItemPreference[],
	catalogueItems: Item[] = listItems({ isActive: true }),
): MatchResult | null {
	if (catalogueItems.length === 0) return null;

	const catalogueMatch = findBestCatalogueItem(itemName, catalogueItems);
	if (!catalogueMatch) return null;
	const historyMatch = findHistoryTieBreaker(
		itemName,
		preferences,
		catalogueItems,
		catalogueMatch.descriptionScore,
	);
	if (historyMatch) {
		return {
			itemCode: historyMatch.code,
			description: historyMatch.description,
			uom: normalizeUom(historyMatch.baseUom),
			unitPrice: historyMatch.price,
			matched: true,
			source: "history",
		};
	}

	return {
		itemCode: catalogueMatch.item.code,
		description: catalogueMatch.item.description,
		uom: normalizeUom(catalogueMatch.item.baseUom),
		unitPrice: catalogueMatch.item.price,
		matched: true,
		source: "catalogue",
	};
}

function findHistoryTieBreaker(
	itemName: string,
	preferences: DebtorItemPreference[],
	catalogueItems: Item[],
	bestDescriptionScore: number,
): Item | null {
	if (preferences.length === 0) return null;

	for (const pref of preferences) {
		const item = catalogueItems.find(
			(catalogueItem) =>
				catalogueItem.code.toLowerCase() === pref.itemCode.toLowerCase(),
		);
		if (!item) continue;

		const preferenceMatch = getTextMatch(itemName, pref.description);
		if (preferenceMatch.matchedMeaningfulTokens === 0) continue;

		const catalogueDescriptionMatch = getTextMatch(itemName, item.description);
		if (catalogueDescriptionMatch.score === bestDescriptionScore) return item;
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
	return findBestPreferenceMatch(itemName, preferences)?.preference ?? null;
}

function findBestPreferenceMatch(
	itemName: string,
	preferences: DebtorItemPreference[],
): PreferenceMatch | null {
	if (preferences.length === 0) return null;

	const tokens = tokenizeSearchText(itemName);
	if (tokens.length === 0) return null;

	let bestMatch: PreferenceMatch | null = null;
	let bestScore = 0;

	for (const pref of preferences) {
		const target = `${pref.itemCode} ${pref.description}`.toLowerCase();
		const match = getTextMatch(itemName, target);

		// Require at least 1 token match
		if (match.score > bestScore) {
			bestScore = match.score;
			bestMatch = {
				preference: pref,
				score: match.score,
				matchedMeaningfulTokens: match.matchedMeaningfulTokens,
			};
		}
	}

	return bestMatch;
}

function findBestCatalogueItem(
	itemName: string,
	catalogueItems: Item[],
): { item: Item; score: number; descriptionScore: number } | null {
	if (catalogueItems.length === 0) return null;

	const [bestMatch] = rankCatalogueItemsByDescription(catalogueItems, itemName);
	return bestMatch && bestMatch.score > 0
		? {
				item: bestMatch.item,
				score: bestMatch.score,
				descriptionScore: bestMatch.descriptionScore,
			}
		: null;
}

/** Tokenize a string into lowercase words, filtering out noise. */
function tokenize(text: string): string[] {
	return tokenizeSearchText(text);
}

// Exported for testing
export {
	findBestCatalogueItem as _findBestCatalogueItem,
	findBestPreference as _findBestPreference,
	scoreTextMatch as _scoreMatch,
	tokenize as _tokenize,
};
