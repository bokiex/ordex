import { createFileRoute } from "@tanstack/react-router";
import { listInvoiceGroups } from "@/lib/db/invoices";

export const Route = createFileRoute("/api/invoices")({
	server: {
		handlers: {
			/**
			 * List invoice groups with optional filters.
			 *
			 * Query params:
			 *   ?debtorCode=  — filter by debtor code
			 *   ?fromDate=    — filter by start date (ISO format)
			 *   ?toDate=      — filter by end date (ISO format)
			 */
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const debtorCode = url.searchParams.get("debtorCode") ?? undefined;
					const fromDate = url.searchParams.get("fromDate") ?? undefined;
					const toDate = url.searchParams.get("toDate") ?? undefined;

					const data = listInvoiceGroups({ debtorCode, fromDate, toDate });
					return Response.json(data);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/invoices GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
