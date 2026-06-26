import type { Item } from "@/lib/db/types";

export type ItemSearchResult = {
	item: Item;
	score: number;
	descriptionScore: number;
	codePenalty: number;
};

export type TextMatchResult = {
	score: number;
	matchedMeaningfulTokens: number;
};

export function searchCatalogueItems(
	items: Item[],
	query: string,
	limit = 20,
): Item[] {
	const trimmed = query.trim();
	if (!trimmed) return items.slice(0, limit);

	return rankCatalogueItems(items, trimmed)
		.filter((result) => result.score > 0)
		.slice(0, limit)
		.map((result) => result.item);
}

export function rankCatalogueItems(
	items: Item[],
	query: string,
): ItemSearchResult[] {
	return items
		.map((item) => {
			const ranked = scoreItemMatch(query, item);
			return {
				item,
				...ranked,
			};
		})
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			if (right.descriptionScore !== left.descriptionScore) {
				return right.descriptionScore - left.descriptionScore;
			}
			if (left.codePenalty !== right.codePenalty) {
				return left.codePenalty - right.codePenalty;
			}
			return left.item.code.localeCompare(right.item.code);
		});
}

export function rankCatalogueItemsByDescription(
	items: Item[],
	query: string,
): ItemSearchResult[] {
	return items
		.map((item) => {
			const descriptionScore = getTextMatch(query, item.description).score;
			return {
				item,
				score: descriptionScore,
				descriptionScore,
				codePenalty: getContradictingCodeTokenPenalty(
					item.description,
					item.code,
				),
			};
		})
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			if (left.codePenalty !== right.codePenalty) {
				return left.codePenalty - right.codePenalty;
			}
			return left.item.code.localeCompare(right.item.code);
		});
}

export function scoreItemMatch(
	query: string,
	item: Item,
): Omit<ItemSearchResult, "item"> {
	const descriptionScore = getTextMatch(query, item.description).score;
	const codeScore = getTextMatch(query, item.code).score;
	const codePenalty = getContradictingCodeTokenPenalty(query, item.code);

	return {
		score: descriptionScore * 2 + codeScore * 0.25 - codePenalty,
		descriptionScore,
		codePenalty,
	};
}

export function scoreTextMatch(query: string, target: string): number {
	return getTextMatch(query, target).score;
}

export function getTextMatch(query: string, target: string): TextMatchResult {
	const queryTokens = tokenizeSearchText(query);
	const targetTokens = tokenizeSearchText(target);
	if (queryTokens.length === 0 || targetTokens.length === 0) {
		return { score: 0, matchedMeaningfulTokens: 0 };
	}

	const targetSet = new Set(targetTokens);
	let score = 0;
	let matchedMeaningfulTokens = 0;

	for (const token of queryTokens) {
		if (targetSet.has(token)) {
			score += isNumericToken(token) ? 18 : 10;
			if (!isNumericToken(token)) matchedMeaningfulTokens++;
			continue;
		}

		const fuzzyMatch = targetTokens.some(
			(targetToken) =>
				token.length >= 4 &&
				targetToken.length >= 4 &&
				levenshteinDistance(token, targetToken) <= 1,
		);
		if (fuzzyMatch) {
			score += 6;
			if (!isNumericToken(token)) matchedMeaningfulTokens++;
		}

		if (isNumericToken(token)) score -= 12;
	}

	const normalizedQuery = normalizeForComparison(query);
	const normalizedTarget = normalizeForComparison(target);
	if (normalizedTarget.includes(normalizedQuery)) score += 20;

	const compactQuery = normalizedQuery.replaceAll(" ", "");
	const compactTarget = normalizedTarget.replaceAll(" ", "");
	if (compactQuery.length >= 4 && compactTarget.includes(compactQuery))
		score += 12;

	return { score, matchedMeaningfulTokens };
}

export function tokenizeSearchText(text: string): string[] {
	const noise = new Set([
		"x",
		"pkt",
		"ctn",
		"carton",
		"kg",
		"pc",
		"pcs",
		"tube",
		"btl",
		"order",
		"please",
		"pls",
		"tks",
		"thanks",
	]);

	return normalizeForComparison(text)
		.split(" ")
		.filter((token) => token.length > 1 && !noise.has(token));
}

function normalizeForComparison(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9/]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function getContradictingCodeTokenPenalty(query: string, code: string): number {
	const queryTokenSet = new Set(tokenizeSearchText(query));
	let penalty = 0;

	for (const token of tokenizeSearchText(code)) {
		for (const word of splitCompoundProductToken(token)) {
			if (!queryTokenSet.has(word)) penalty += 2;
		}
	}

	return penalty;
}

function splitCompoundProductToken(token: string): string[] {
	const productWords = [
		"kway",
		"teow",
		"hor",
		"fun",
		"yellow",
		"noodle",
		"mee",
		"kia",
		"pok",
		"big",
		"medium",
		"small",
	];

	return productWords.filter((word) => token.includes(word));
}

function isNumericToken(token: string): boolean {
	return /\d/.test(token);
}

function levenshteinDistance(left: string, right: string): number {
	if (left === right) return 0;
	if (left.length === 0) return right.length;
	if (right.length === 0) return left.length;

	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

	for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
		const current = [leftIndex];
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
			const substitutionCost =
				left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			current[rightIndex] = Math.min(
				current[rightIndex - 1] + 1,
				previous[rightIndex] + 1,
				previous[rightIndex - 1] + substitutionCost,
			);
		}
		previous = current;
	}

	return previous[right.length];
}
