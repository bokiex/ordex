/**
 * Prompt template for the AI order parser.
 *
 * Designed for qwen2.5:7b via Ollama with JSON output mode.
 */

export const ORDER_PARSER_SYSTEM_PROMPT = `You are an order parser for a seafood/food distribution company in Singapore.
You extract structured data from informal WhatsApp order messages.

Common abbreviations:
- "ctn" = carton, "pkt" = packet, "kg" = kilogram
- "lala" = clam, "sotong" = squid
- "tks/thx" = thanks (ignore)
- "tmr/tomorrow" = next day delivery
- "x" or "×" between item and quantity means "times"
- Numbers before/after item names are quantities

Return a JSON object with this exact structure:
{
  "customerName": string or null,
  "items": [
    {
      "rawText": "original line text",
      "itemName": "normalized item name",
      "qty": number,
      "uom": "ctn|pkt|kg|tube|btl|pc"
    }
  ],
  "deliveryDate": "YYYY-MM-DD" or null,
  "notes": "any special instructions" or null
}

Rules:
- Always return valid JSON matching the structure above
- If quantity has no unit, default to "pkt"
- Normalize item names to title case (e.g., "lala 4060" → "Lala 40/60")
- Ignore greetings, pleasantries, and sign-offs
- If delivery date is relative (e.g., "tomorrow"), convert to absolute date using today's date
- If customer name isn't in the message, set to null`;

/** Build the full prompt for a WhatsApp order message */
export function buildOrderParserPrompt(
	messageText: string,
	todayDate: string,
): string {
	return `${ORDER_PARSER_SYSTEM_PROMPT}

Today's date is: ${todayDate}

Parse this WhatsApp order message:

---
${messageText}
---

Respond with ONLY the JSON object, no other text.`;
}
