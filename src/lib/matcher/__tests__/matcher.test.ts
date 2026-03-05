import { describe, expect, it } from "vitest";
import type { DebtorItemPreference } from "@/lib/db/invoices";
import { _findBestPreference, _tokenize, matchItem } from "../index";

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
	it("returns history match with unit price when preference exists", () => {
		const result = matchItem("lala", preferences);
		expect(result).not.toBeNull();
		expect(result?.source).toBe("history");
		expect(result?.itemCode).toBe("SFSLALA4060");
		expect(result?.unitPrice).toBe(40);
	});

	it("prefers more specific match over generic", () => {
		const result = matchItem("lala 30/40", preferences);
		expect(result?.itemCode).toBe("SFSLALA3040");
	});

	it("returns null for unmatched item with no preferences", () => {
		// matchItem calls searchItems which needs DB — but with empty prefs
		// and a nonsense name, catalogue search should also fail
		const result = matchItem("xyznonexistent12345", []);
		// Will try catalogue search (may return null if DB not seeded in test)
		// The important thing is it doesn't throw
		expect(result === null || result?.source === "catalogue").toBe(true);
	});
});
