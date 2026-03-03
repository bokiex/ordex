/**
 * Ollama API client for order parsing.
 *
 * Uses the qwen2.5:7b model via Ollama REST API.
 */

import { buildOrderParserPrompt } from "./prompt.ts";
import type {
	OllamaGenerateRequest,
	OllamaGenerateResponse,
	ParsedOrder,
} from "./types.ts";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

/** Parse a WhatsApp order message using Ollama */
export async function parseOrderMessage(
	messageText: string,
	todayDate?: string,
): Promise<ParsedOrder> {
	const today = todayDate ?? new Date().toISOString().split("T")[0];
	const prompt = buildOrderParserPrompt(messageText, today);

	const requestBody: OllamaGenerateRequest = {
		model: OLLAMA_MODEL,
		prompt,
		stream: false,
		format: "json",
		options: {
			temperature: 0.1, // Low temperature for consistent structured output
			num_predict: 1024,
		},
	};

	const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Ollama API error (${response.status}): ${errorText}`);
	}

	const result: OllamaGenerateResponse = await response.json();

	return validateParsedOrder(result.response);
}

/** Validate and parse the JSON response from Ollama */
export function validateParsedOrder(jsonString: string): ParsedOrder {
	const parsed = JSON.parse(jsonString);

	// Ensure required structure
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Ollama returned non-object response");
	}

	const order: ParsedOrder = {
		customerName: parsed.customerName ?? null,
		items: [],
		deliveryDate: parsed.deliveryDate ?? null,
		notes: parsed.notes ?? null,
	};

	if (Array.isArray(parsed.items)) {
		for (const item of parsed.items) {
			if (item && typeof item.qty === "number" && item.itemName) {
				order.items.push({
					rawText: String(item.rawText ?? ""),
					itemName: String(item.itemName),
					qty: item.qty,
					uom: String(item.uom ?? "pkt"),
				});
			}
		}
	}

	if (order.items.length === 0) {
		throw new Error("No valid order items parsed from message");
	}

	return order;
}
