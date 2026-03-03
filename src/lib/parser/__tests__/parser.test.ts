import { describe, expect, it } from "vitest";
import { validateParsedOrder } from "../ollama.ts";
import {
	buildOrderParserPrompt,
	ORDER_PARSER_SYSTEM_PROMPT,
} from "../prompt.ts";

describe("buildOrderParserPrompt", () => {
	it("includes the system prompt and message text", () => {
		const prompt = buildOrderParserPrompt("Lala 40/60 x 10 ctn", "2026-03-03");

		expect(prompt).toContain(ORDER_PARSER_SYSTEM_PROMPT);
		expect(prompt).toContain("Lala 40/60 x 10 ctn");
		expect(prompt).toContain("2026-03-03");
	});

	it("includes today's date for relative date resolution", () => {
		const prompt = buildOrderParserPrompt("order for tmr", "2026-03-03");
		expect(prompt).toContain("Today's date is: 2026-03-03");
	});
});

describe("validateParsedOrder", () => {
	it("parses a valid JSON response into a ParsedOrder", () => {
		const json = JSON.stringify({
			customerName: "Joseph FK Trading",
			items: [
				{
					rawText: "Lala 40/60 x 10 ctn",
					itemName: "Lala 40/60",
					qty: 10,
					uom: "ctn",
				},
				{
					rawText: "Sotong ball x 5 pkt",
					itemName: "Sotong Ball",
					qty: 5,
					uom: "pkt",
				},
			],
			deliveryDate: "2026-03-04",
			notes: null,
		});

		const order = validateParsedOrder(json);
		expect(order.customerName).toBe("Joseph FK Trading");
		expect(order.items).toHaveLength(2);
		expect(order.items[0]).toEqual({
			rawText: "Lala 40/60 x 10 ctn",
			itemName: "Lala 40/60",
			qty: 10,
			uom: "ctn",
		});
		expect(order.items[1].itemName).toBe("Sotong Ball");
		expect(order.deliveryDate).toBe("2026-03-04");
		expect(order.notes).toBeNull();
	});

	it("defaults missing uom to 'pkt'", () => {
		const json = JSON.stringify({
			items: [
				{
					itemName: "Fish Cake",
					qty: 20,
				},
			],
		});

		const order = validateParsedOrder(json);
		expect(order.items[0].uom).toBe("pkt");
	});

	it("defaults missing customerName and deliveryDate to null", () => {
		const json = JSON.stringify({
			items: [{ itemName: "Lala", qty: 5, uom: "ctn" }],
		});

		const order = validateParsedOrder(json);
		expect(order.customerName).toBeNull();
		expect(order.deliveryDate).toBeNull();
		expect(order.notes).toBeNull();
	});

	it("throws when no valid items are present", () => {
		const json = JSON.stringify({
			customerName: "Test",
			items: [],
		});

		expect(() => validateParsedOrder(json)).toThrow(
			"No valid order items parsed",
		);
	});

	it("throws for items missing required fields", () => {
		const json = JSON.stringify({
			items: [{ rawText: "something" }],
		});

		expect(() => validateParsedOrder(json)).toThrow(
			"No valid order items parsed",
		);
	});

	it("throws for non-object JSON", () => {
		expect(() => validateParsedOrder('"just a string"')).toThrow();
	});

	it("filters out invalid items while keeping valid ones", () => {
		const json = JSON.stringify({
			items: [
				{ itemName: "Valid Item", qty: 5, uom: "ctn" },
				{ rawText: "invalid - no qty" },
				{ itemName: "Also Valid", qty: 3, uom: "pkt" },
			],
		});

		const order = validateParsedOrder(json);
		expect(order.items).toHaveLength(2);
		expect(order.items[0].itemName).toBe("Valid Item");
		expect(order.items[1].itemName).toBe("Also Valid");
	});

	it("coerces rawText to string", () => {
		const json = JSON.stringify({
			items: [
				{
					rawText: 123,
					itemName: "Test Item",
					qty: 1,
					uom: "pkt",
				},
			],
		});

		const order = validateParsedOrder(json);
		expect(order.items[0].rawText).toBe("123");
	});
});
