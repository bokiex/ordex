import { createFileRoute } from "@tanstack/react-router";
import { addOrderItem } from "@/lib/db/orders";

export const Route = createFileRoute("/api/orders/$id/items")({
	server: {
		handlers: {
			/**
			 * Add a line item to an existing order.
			 *
			 * Body: { itemCode?, rawItemName?, description?, uom?, qty, unitPrice? }
			 */
			POST: async ({ request, params }) => {
				try {
					const body = await request.json();

					if (body.qty === undefined || typeof body.qty !== "number") {
						return Response.json(
							{ error: "Missing or invalid 'qty' field" },
							{ status: 400 },
						);
					}

					const item = addOrderItem(Number(params.id), {
						itemCode: body.itemCode || null,
						rawItemName: body.rawItemName || null,
						description: body.description || null,
						uom: body.uom || null,
						qty: body.qty,
						unitPrice: body.unitPrice ?? null,
						lineTotal: body.lineTotal ?? null,
						matched: body.matched ?? false,
					});

					return Response.json(item, { status: 201 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id/items POST] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
