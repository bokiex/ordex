import { createFileRoute } from "@tanstack/react-router";
import { deleteOrderItem, updateOrderItem } from "@/lib/db/orders";

export const Route = createFileRoute("/api/order-items/$id")({
	server: {
		handlers: {
			/**
			 * Update an order line item.
			 *
			 * Body: Partial fields (itemCode, rawItemName, description, uom, qty, unitPrice, matched).
			 */
			PUT: async ({ request, params }) => {
				try {
					const body = await request.json();
					const updated = updateOrderItem(Number(params.id), body);

					if (!updated) {
						return Response.json(
							{
								error: `Order item '${params.id}' not found`,
							},
							{ status: 404 },
						);
					}

					return Response.json(updated);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/order-items/$id PUT] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Delete an order line item.
			 */
			DELETE: async ({ params }) => {
				try {
					const deleted = deleteOrderItem(Number(params.id));

					if (!deleted) {
						return Response.json(
							{
								error: `Order item '${params.id}' not found`,
							},
							{ status: 404 },
						);
					}

					return new Response(null, { status: 204 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/order-items/$id DELETE] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
