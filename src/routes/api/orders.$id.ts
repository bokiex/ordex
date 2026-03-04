import { createFileRoute } from "@tanstack/react-router";
import { deleteOrder, getOrderWithItems, updateOrder } from "@/lib/db/orders";

export const Route = createFileRoute("/api/orders/$id")({
	server: {
		handlers: {
			/**
			 * Get a single order with all line items and matched item data.
			 */
			GET: async ({ params }) => {
				try {
					const order = getOrderWithItems(Number(params.id));

					if (!order) {
						return Response.json(
							{ error: `Order '${params.id}' not found` },
							{ status: 404 },
						);
					}

					return Response.json(order);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Update order header fields.
			 *
			 * Body: Partial order fields (excluding id).
			 */
			PUT: async ({ request, params }) => {
				try {
					const id = Number(params.id);
					const existing = getOrderWithItems(id);

					if (!existing) {
						return Response.json(
							{ error: `Order '${params.id}' not found` },
							{ status: 404 },
						);
					}

					const body = await request.json();
					updateOrder(id, body);

					const updated = getOrderWithItems(id);
					return Response.json(updated);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id PUT] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Delete an order and all its line items.
			 */
			DELETE: async ({ params }) => {
				try {
					const deleted = deleteOrder(Number(params.id));

					if (!deleted) {
						return Response.json(
							{ error: `Order '${params.id}' not found` },
							{ status: 404 },
						);
					}

					return new Response(null, { status: 204 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id DELETE] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
