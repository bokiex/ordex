import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DebtorItemPreference } from "@/lib/db/invoices";
import type { Item } from "@/lib/db/types";
import { _findBestPreference, _tokenize, matchItem } from "../index";

const listItemsMock = vi.fn();

vi.mock("@/lib/db/items", () => ({
	listItems: (...args: unknown[]) => listItemsMock(...args),
}));

// ─── Test data ──────────────────────────────────────────────────────────────

const preferences: DebtorItemPreference[] = [
	{
		itemCode: "SFSLALA4060",
		description: "WHITE CLAM LALA 40/60 (500G X 20PKT)",
		uom: "CTN",
		lastUnitPrice: 40,
		orderCount: 12,
	},
	{
		itemCode: "SFSLALA3040",
		description: "WHITE CLAM LALA 30/40 (500G X 20PKT)",
		uom: "CTN",
		lastUnitPrice: 45,
		orderCount: 3,
	},
	{
		itemCode: "SFSSOTONGT",
		description: "SOTONG TUBE (1KG X 10PKT)",
		uom: "CTN",
		lastUnitPrice: 55,
		orderCount: 8,
	},
	{
		itemCode: "BFNOODLE01",
		description: "YELLOW NOODLE THICK 500G",
		uom: "PKT",
		lastUnitPrice: 2.5,
		orderCount: 20,
	},
];

const catalogueItems: Item[] = [
	{
		code: "SFSLALA4060",
		description: "WHITE CLAM LALA 40/60 (500G X 20PKT)",
		baseUom: "CTN",
		uomCount: 1,
		itemGroup: "Seafood",
		isActive: true,
		price: 40,
	},
	{
		code: "SFSLALA3040",
		description: "WHITE CLAM LALA 30/40 (500G X 20PKT)",
		baseUom: "CTN",
		uomCount: 1,
		itemGroup: "Seafood",
		isActive: true,
		price: 45,
	},
	{
		code: "BFNOODLE01",
		description: "YELLOW NOODLE THICK 500G",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: 2.5,
	},
];

const noodleCatalogueItems: Item[] = [
	{
		code: "BEEHUAT KwayTeow M",
		description: "Kway Teow (medium) (3kg) 中粿条",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: 4,
	},
	{
		code: "BEEHUAT KwayTeow S",
		description: "Kway Teow (small) (3kg) 小粿条",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: 4.25,
	},
	{
		code: "BEEHUAT KwayTeow BIG",
		description: "Hor Fun (3kg) 大粿条/河粉",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: null,
	},
	{
		code: "NVKWTE3KGHF",
		description: "Hor Fun (3kg) 大粿条/河粉",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: 3.3,
	},
	{
		code: "NVYENOO3KG",
		description: "Yellow Noodle Mee (Round) (3kg) 熟面/圆面",
		baseUom: "PKT",
		uomCount: 1,
		itemGroup: "Noodle",
		isActive: true,
		price: null,
	},
];

const kwayTeowPreference: DebtorItemPreference[] = [
	{
		itemCode: "BEEHUAT KwayTeow S",
		description: "Kway Teow (small) (3kg) 小粿条",
		uom: "PKT",
		lastUnitPrice: 4.25,
		orderCount: 10,
	},
];

beforeEach(() => {
	listItemsMock.mockReset();
	listItemsMock.mockReturnValue(catalogueItems);
});

// ─── tokenize ───────────────────────────────────────────────────────────────

describe("tokenize", () => {
	it("splits into lowercase tokens", () => {
		expect(_tokenize("White Clam LALA")).toEqual(["white", "clam", "lala"]);
	});

	it("filters out noise words and UOMs", () => {
		expect(_tokenize("lala x 5 pkt")).toEqual(["lala"]);
	});

	it("keeps numbers with slashes (sizes)", () => {
		expect(_tokenize("lala 40/60")).toEqual(["lala", "40/60"]);
	});

	it("returns empty for noise-only input", () => {
		expect(_tokenize("x pkt")).toEqual([]);
	});
});

// ─── findBestPreference ─────────────────────────────────────────────────────

describe("findBestPreference", () => {
	it("matches lala to most-ordered lala variant", () => {
		const result = _findBestPreference("lala", preferences);
		expect(result?.itemCode).toBe("SFSLALA4060");
	});

	it("matches lala 30/40 to the specific size variant", () => {
		const result = _findBestPreference("lala 30/40", preferences);
		expect(result?.itemCode).toBe("SFSLALA3040");
	});

	it("matches sotong to sotong tube", () => {
		const result = _findBestPreference("sotong", preferences);
		expect(result?.itemCode).toBe("SFSSOTONGT");
	});

	it("matches yellow noodle", () => {
		const result = _findBestPreference("yellow noodle", preferences);
		expect(result?.itemCode).toBe("BFNOODLE01");
	});

	it("returns null for completely unrelated item", () => {
		const result = _findBestPreference("chicken wings", preferences);
		expect(result).toBeNull();
	});

	it("returns null for empty preferences", () => {
		const result = _findBestPreference("lala", []);
		expect(result).toBeNull();
	});
});

// ─── matchItem (integration) ────────────────────────────────────────────────

describe("matchItem", () => {
	it("uses history as a tie-breaker between equal catalogue description matches", () => {
		const result = matchItem("lala", preferences);
		expect(result).not.toBeNull();
		expect(result?.source).toBe("history");
		expect(result?.itemCode).toBe("SFSLALA4060");
	});

	it("uses active catalogue price for history tie-breaker matches", () => {
		const result = matchItem("lala", preferences, [
			{ ...catalogueItems[0], price: 42 },
			catalogueItems[1],
		]);

		expect(result?.source).toBe("history");
		expect(result?.itemCode).toBe("SFSLALA4060");
		expect(result?.unitPrice).toBe(42);
	});

	it("uses history when it points at an equal best description match", () => {
		const result = matchItem(
			"Hor Fun 3kg",
			[
				{
					itemCode: "BEEHUAT KwayTeow BIG",
					description: "Hor Fun (3kg) 大粿条/河粉",
					uom: "PKT",
					lastUnitPrice: 4.25,
					orderCount: 10,
				},
			],
			noodleCatalogueItems,
		);

		expect(result?.source).toBe("history");
		expect(result?.itemCode).toBe("BEEHUAT KwayTeow BIG");
	});

	it("prefers more specific match over generic", () => {
		const result = matchItem("lala 30/40", preferences);
		expect(result?.itemCode).toBe("SFSLALA3040");
	});

	it("ranks the whole catalogue instead of requiring an exact phrase", () => {
		const result = matchItem("thick yellow noodles", []);

		expect(listItemsMock).toHaveBeenCalledWith({ isActive: true });
		expect(result?.itemCode).toBe("BFNOODLE01");
		expect(result?.source).toBe("catalogue");
		expect(result?.unitPrice).toBe(2.5);
	});

	it("uses fuzzy token matching for minor spelling differences", () => {
		const result = matchItem("yelow noodle", []);

		expect(result?.itemCode).toBe("BFNOODLE01");
	});

	it("ignores historical codes that are no longer in the active catalogue", () => {
		const result = matchItem("sotong", preferences);

		expect(result).toBeNull();
	});

	it("returns null instead of repeating the first catalogue item when nothing matches", () => {
		const result = matchItem("xyznonexistent12345", []);

		expect(result).toBeNull();
	});

	it("returns null only when the active catalogue is empty", () => {
		listItemsMock.mockReturnValue([]);

		const result = matchItem("lala", []);

		expect(result).toBeNull();
	});

	it("does not let history matched only by size override hor fun", () => {
		const result = matchItem(
			"Hor Fun 3kg",
			kwayTeowPreference,
			noodleCatalogueItems,
		);

		expect(result?.source).toBe("catalogue");
		expect(result?.itemCode).toBe("NVKWTE3KGHF");
	});

	it("matches yellow noodle mee to the closest yellow noodle description", () => {
		const result = matchItem(
			"Yellow Noodle Mee 3kg",
			kwayTeowPreference,
			noodleCatalogueItems,
		);

		expect(result?.source).toBe("catalogue");
		expect(result?.itemCode).toBe("NVYENOO3KG");
	});

	it("matches kway teow medium to the medium kway teow item", () => {
		const result = matchItem(
			"Kway Teow Medium",
			kwayTeowPreference,
			noodleCatalogueItems,
		);

		expect(result?.source).toBe("catalogue");
		expect(result?.itemCode).toBe("BEEHUAT KwayTeow M");
	});
});
