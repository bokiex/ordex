import { createFileRoute } from "@tanstack/react-router";
import { listOrders } from "@/lib/db/orders";
import type { OrderStatus } from "@/lib/db/types";
import { createOrderFromMessage } from "@/lib/orders";

export const Route = createFileRoute("/api/orders")({
	server: {
		handlers: {
			/**
			 * List orders, optionally filtered by status.
			 *
			 * Query params:
			 *   ?status=draft|confirmed|exported
			 */
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const status = url.searchParams.get("status") as OrderStatus | null;

					const data = listOrders(status ? { status } : undefined);
					return Response.json(data);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Create a new order by parsing a WhatsApp message with AI.
			 *
			 * Body: { message: string, date?: string, customerNameHint?: string }
			 *
			 * Flow:
			 * 1. Parse message via Ollama
			 * 2. Match customer to debtor
			 * 3. Match each item to product catalogue
			 * 4. Create order with line items
			 * 5. Return full order with items
			 */
			POST: async ({ request }) => {
				const body = await request.json();

				if (!body.message || typeof body.message !== "string") {
					return Response.json(
						{ error: "Missing or invalid 'message' field" },
						{ status: 400 },
					);
				}

				if (
					body.customerNameHint != null &&
					typeof body.customerNameHint !== "string"
				) {
					return Response.json(
						{ error: "Invalid 'customerNameHint' field" },
						{ status: 400 },
					);
				}

				const result = await createOrderFromMessage({
					message: body.message,
					date: body.date,
					customerNameHint: body.customerNameHint,
				});

				if (!result.success) {
					if (result.stage === "parse") {
						console.error("[API /api/orders POST] Ollama error:", result.error);
						return Response.json(
							{ error: `Failed to parse order: ${result.error}` },
							{ status: 502 },
						);
					}

					console.error("[API /api/orders POST] Error:", result.error);
					return Response.json(
						{ error: `Internal server error: ${result.error}` },
						{ status: 500 },
					);
				}

				return Response.json(result.order, { status: 201 });
			},
		},
	},
});
