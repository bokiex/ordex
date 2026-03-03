/**
 * Types for the AI Order Parser (ORD-7)
 */

/** A single parsed order line from a WhatsApp message */
export interface ParsedOrderItem {
	rawText: string; // Original text fragment that was parsed
	itemName: string; // Extracted item name/description
	qty: number; // Quantity ordered
	uom: string; // Unit of measure (ctn, pkt, kg, etc.)
}

/** The full parsed result from a WhatsApp order message */
export interface ParsedOrder {
	customerName: string | null; // Extracted customer name if present
	items: ParsedOrderItem[];
	deliveryDate: string | null; // Extracted delivery date if mentioned (ISO format)
	notes: string | null; // Any additional notes/instructions
}

/** Ollama API request body */
export interface OllamaGenerateRequest {
	model: string;
	prompt: string;
	stream: false;
	format: "json";
	options?: {
		temperature?: number;
		num_predict?: number;
	};
}

/** Ollama API response body */
export interface OllamaGenerateResponse {
	model: string;
	created_at: string;
	response: string; // JSON string when format: "json"
	done: boolean;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	eval_count?: number;
}
