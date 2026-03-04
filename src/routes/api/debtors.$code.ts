import { createFileRoute } from "@tanstack/react-router";
import { deleteDebtor, getDebtor, updateDebtor } from "@/lib/db/debtors";

export const Route = createFileRoute("/api/debtors/$code")({
	server: {
		handlers: {
			/**
			 * Get a single debtor by its code.
			 */
			GET: async ({ params }) => {
				try {
					const debtor = getDebtor(params.code);

					if (!debtor) {
						return Response.json(
							{ error: `Debtor '${params.code}' not found` },
							{ status: 404 },
						);
					}

					return Response.json(debtor);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/debtors/$code GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Update a debtor by its code.
			 *
			 * Body: Partial debtor fields (excluding code).
			 */
			PUT: async ({ request, params }) => {
				try {
					const existing = getDebtor(params.code);

					if (!existing) {
						return Response.json(
							{ error: `Debtor '${params.code}' not found` },
							{ status: 404 },
						);
					}

					const body = await request.json();
					const updated = updateDebtor(params.code, body);
					return Response.json(updated);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/debtors/$code PUT] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Delete a debtor by its code.
			 */
			DELETE: async ({ params }) => {
				try {
					const deleted = deleteDebtor(params.code);

					if (!deleted) {
						return Response.json(
							{ error: `Debtor '${params.code}' not found` },
							{ status: 404 },
						);
					}

					return new Response(null, { status: 204 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/debtors/$code DELETE] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
