import { createFileRoute } from "@tanstack/react-router";
import { getInvoiceGroup } from "@/lib/db/invoices";

export const Route = createFileRoute("/api/invoices/$docNo")({
	server: {
		handlers: {
			/**
			 * Get a single invoice group by document number.
			 */
			GET: async ({ params }) => {
				try {
					const invoice = getInvoiceGroup(params.docNo);

					if (!invoice) {
						return Response.json(
							{ error: `Invoice '${params.docNo}' not found` },
							{ status: 404 },
						);
					}

					return Response.json(invoice);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/invoices/$docNo GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
