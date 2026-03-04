import { createFileRoute } from "@tanstack/react-router";
import { searchDebtors } from "@/lib/db/debtors";
import { searchItems } from "@/lib/db/items";
import { createOrder, listOrders } from "@/lib/db/orders";
import type { OrderStatus } from "@/lib/db/types";
import { parseOrderMessage } from "@/lib/parser/index";

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
			 * Body: { message: string, date?: string }
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

				let parsedOrder: Awaited<ReturnType<typeof parseOrderMessage>>;
				try {
					parsedOrder = await parseOrderMessage(body.message, body.date);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders POST] Ollama error:", message);
					return Response.json(
						{ error: `Failed to parse order: ${message}` },
						{ status: 502 },
					);
				}

				try {
					// Match customer to debtor
					let debtorCode: string | null = null;
					if (parsedOrder.customerName) {
						const matchedDebtors = searchDebtors(parsedOrder.customerName);
						if (matchedDebtors.length > 0) {
							debtorCode = matchedDebtors[0].code;
						}
					}

					// Determine document date
					const docDate =
						parsedOrder.deliveryDate ||
						body.date ||
						new Date().toISOString().split("T")[0];

					// Build line items with item matching
					const lineItems = parsedOrder.items.map((item) => {
						const matchedItems = searchItems(item.itemName);
						const matchedItem =
							matchedItems.length > 0 ? matchedItems[0] : null;

						return {
							itemCode: matchedItem ? matchedItem.code : null,
							rawItemName: item.rawText,
							description: matchedItem
								? matchedItem.description
								: item.itemName,
							uom: item.uom || matchedItem?.baseUom || null,
							qty: item.qty,
							matched: !!matchedItem,
						};
					});

					// Create order with line items
					const order = createOrder(
						{
							debtorCode,
							debtorName: parsedOrder.customerName || "Unknown",
							docDate,
							rawMessage: body.message,
							status: "draft",
						},
						lineItems,
					);

					return Response.json(order, { status: 201 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders POST] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
