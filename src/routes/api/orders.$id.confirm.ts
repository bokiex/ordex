import { createFileRoute } from "@tanstack/react-router";
import { confirmOrder, getOrderWithItems } from "@/lib/db/orders";
import { publishOrdersChanged } from "@/lib/events/incomingMessages";

export const Route = createFileRoute("/api/orders/$id/confirm")({
	server: {
		handlers: {
			/**
			 * Confirm a draft order.
			 *
			 * Validates:
			 * - Order exists
			 * - Status is "draft"
			 * - Debtor code is assigned
			 * - All line items are matched to item codes
			 */
			POST: async ({ params }) => {
				try {
					const id = Number(params.id);
					const order = getOrderWithItems(id);

					if (!order) {
						return Response.json(
							{ error: `Order '${params.id}' not found` },
							{ status: 404 },
						);
					}

					if (order.status !== "draft") {
						return Response.json(
							{ error: "Order is not in draft status" },
							{ status: 400 },
						);
					}

					if (!order.debtorCode) {
						return Response.json(
							{ error: "Customer must be assigned" },
							{ status: 400 },
						);
					}

					const unmatchedItems = order.items.filter(
						(item) => !item.itemCode || !item.matched,
					);
					if (unmatchedItems.length > 0) {
						return Response.json(
							{ error: "All items must be matched" },
							{ status: 400 },
						);
					}

					confirmOrder(id);
					publishOrdersChanged({ action: "confirmed", orderId: id });

					const updated = getOrderWithItems(id);
					return Response.json(updated);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id/confirm POST] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
