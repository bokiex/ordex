import { createFileRoute } from "@tanstack/react-router";
import { createItem, listItems, searchItems } from "@/lib/db/items";

export const Route = createFileRoute("/api/items")({
	server: {
		handlers: {
			/**
			 * List or search items.
			 *
			 * Query params:
			 *   ?search=  — fuzzy search by code or description
			 */
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const search = url.searchParams.get("search");

					const data = search ? searchItems(search) : listItems();
					return Response.json(data);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/items GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Create a new item.
			 *
			 * Body: { code: string, description: string, baseUom: string, ... }
			 */
			POST: async ({ request }) => {
				try {
					const body = await request.json();

					if (!body.code || typeof body.code !== "string") {
						return Response.json(
							{ error: "Missing or invalid 'code' field" },
							{ status: 400 },
						);
					}
					if (!body.description || typeof body.description !== "string") {
						return Response.json(
							{ error: "Missing or invalid 'description' field" },
							{ status: 400 },
						);
					}
					if (!body.baseUom || typeof body.baseUom !== "string") {
						return Response.json(
							{ error: "Missing or invalid 'baseUom' field" },
							{ status: 400 },
						);
					}

					const item = createItem(body);
					return Response.json(item, { status: 201 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/items POST] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
