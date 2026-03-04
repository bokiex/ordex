import { createFileRoute } from "@tanstack/react-router";
import { createDebtor, listDebtors, searchDebtors } from "@/lib/db/debtors";

export const Route = createFileRoute("/api/debtors")({
	server: {
		handlers: {
			/**
			 * List or search debtors.
			 *
			 * Query params:
			 *   ?search=  — fuzzy search by company name, alias, or code
			 */
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const search = url.searchParams.get("search");

					const data = search ? searchDebtors(search) : listDebtors();
					return Response.json(data);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/debtors GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			/**
			 * Create a new debtor.
			 *
			 * Body: { code: string, companyName: string, ... }
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
					if (!body.companyName || typeof body.companyName !== "string") {
						return Response.json(
							{ error: "Missing or invalid 'companyName' field" },
							{ status: 400 },
						);
					}

					const debtor = createDebtor(body);
					return Response.json(debtor, { status: 201 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/debtors POST] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
