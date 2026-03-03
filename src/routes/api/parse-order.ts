import { createFileRoute } from "@tanstack/react-router";
import { parseOrderMessage } from "@/lib/parser/index.ts";

export const Route = createFileRoute("/api/parse-order")({
	server: {
		handlers: {
			/**
			 * Parse a WhatsApp order message using AI (Ollama).
			 *
			 * Accepts JSON body: { message: string, date?: string }
			 * Returns parsed order structure.
			 */
			POST: async ({ request }) => {
				const body = await request.json();

				if (!body.message || typeof body.message !== "string") {
					return Response.json(
						{ error: "Missing or invalid 'message' field" },
						{ status: 400 },
					);
				}

				try {
					const parsed = await parseOrderMessage(body.message, body.date);
					return Response.json(parsed);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[OrderParser] Error:", message);
					return Response.json(
						{ error: `Failed to parse order: ${message}` },
						{ status: 502 },
					);
				}
			},
		},
	},
});
