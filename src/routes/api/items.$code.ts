import { createFileRoute } from "@tanstack/react-router";
import { deleteItem, getItem, updateItem } from "@/lib/db/items";

export const Route = createFileRoute("/api/items/$code")({
	server: {
		handlers: {
			/**
			 * Get a single item by its code.
			 */
			GET: async ({ params }) => {
				try {
					const item = getItem(params.code);

					if (!item) {
						return Response.json(
							{ error: `Item '${params.code}' not found` },
							{ status: 404 },
						);
					}

					return Response.json(item);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/items/$code GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Update an item by its code.
			 *
			 * Body: Partial item fields (excluding code).
			 */
			PUT: async ({ request, params }) => {
				try {
					const existing = getItem(params.code);

					if (!existing) {
						return Response.json(
							{ error: `Item '${params.code}' not found` },
							{ status: 404 },
						);
					}

					const body = await request.json();
					const updated = updateItem(params.code, body);
					return Response.json(updated);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/items/$code PUT] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Delete an item by its code.
			 */
			DELETE: async ({ params }) => {
				try {
					const deleted = deleteItem(params.code);

					if (!deleted) {
						return Response.json(
							{ error: `Item '${params.code}' not found` },
							{ status: 404 },
						);
					}

					return new Response(null, { status: 204 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/items/$code DELETE] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
