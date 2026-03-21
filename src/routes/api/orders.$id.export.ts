import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { getOrderWithItems, markOrderExported } from "@/lib/db/orders";

/**
 * AutoCount Invoice import template columns (99 cols).
 * Must match Default Sales.xlsx → Invoice sheet header exactly.
 */
const INVOICE_HEADERS = [
	"DocNo",
	"DocDate",
	"DebtorCode",
	"DebtorName",
	"Ref",
	"Description",
	"DisplayTerm",
	"SalesAgent",
	"InvAddr1",
	"InvAddr2",
	"InvAddr3",
	"InvAddr4",
	"Phone1",
	"Fax1",
	"Attention",
	"BranchCode",
	"DeliverAddr1",
	"DeliverAddr2",
	"DeliverAddr3",
	"DeliverAddr4",
	"DeliverPhone1",
	"DeliverFax1",
	"DeliverContact",
	"SalesExemptionNo",
	"SalesExemptionExpiryDate",
	"Footer1Param",
	"Footer1Amt",
	"Footer1TaxType",
	"Footer2Param",
	"Footer2Amt",
	"Footer2TaxType",
	"Footer3Param",
	"Footer3Amt",
	"Footer3TaxType",
	"CurrencyCode",
	"CurrencyRate",
	"Tax",
	"PostToStock",
	"PostToGL",
	"Transferable",
	"Note",
	"Remark1",
	"Remark2",
	"Remark3",
	"Remark4",
	"Cancelled",
	"RefDocNo",
	"MemberNo",
	"ShipVia",
	"ShipInfo",
	"SalesLocation",
	"Footer1Tax",
	"Footer2Tax",
	"Footer3Tax",
	"ToTaxCurrencyRate",
	"CalcDiscountOnUnitPrice",
	"TaxDocNo",
	"InclusiveTax",
	"Footer1TaxRate",
	"Footer2TaxRate",
	"Footer3TaxRate",
	"TaxDate",
	"IsRoundAdj",
	"RoundingMethod",
	"Numbering",
	"ItemCode",
	"Location",
	"BatchNo",
	"DetailDescription",
	"FurtherDescription",
	"YourPONo",
	"YourPODate",
	"ProjNo",
	"DeptNo",
	"UOM",
	"UserUOM",
	"Qty",
	"FOCQty",
	"UnitPrice",
	"Discount",
	"DiscountAmt",
	"TaxType",
	"SubTotal",
	"BonusPoint",
	"DetailTransferable",
	"PrintOut",
	"CalcByPercent",
	"AddToSubTotal",
	"ForConsignment",
	"AccNo",
	"OurDONo",
	"OurDODate",
	"EstimatedDeliveryDate",
	"DeliveryDate",
	"TaxableAmt",
	"TaxAdjustment",
	"TaxExportCountry",
	"TaxRate",
	"LocalTaxAdjustment",
] as const;

export const Route = createFileRoute("/api/orders/$id/export")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const id = Number(params.id);
					const order = getOrderWithItems(id);

					if (!order) {
						return Response.json(
							{ error: `Order '${params.id}' not found` },
							{ status: 404 },
						);
					}

					if (order.status === "draft") {
						return Response.json(
							{ error: "Order must be confirmed before export" },
							{ status: 400 },
						);
					}

					// Build rows: one per line item, header fields repeated on each row
					const dataRows = order.items.map((line) => {
						const row: Record<string, unknown> = {};
						for (const col of INVOICE_HEADERS) {
							row[col] = "";
						}

						// Header-level fields
						row.DocDate = order.docDate;
						row.DebtorCode = order.debtorCode ?? "";
						row.DebtorName = order.debtorName ?? "";
						row.SalesAgent = order.agent ?? "";
						row.CurrencyCode = "SGD";
						row.CurrencyRate = 1;

						// Line-item fields
						row.ItemCode = line.itemCode ?? "";
						row.DetailDescription = line.description ?? line.rawItemName ?? "";
						row.UOM = line.uom ?? "";
						row.Qty = line.qty;
						row.UnitPrice = line.unitPrice ?? 0;
						row.Location = "HQ";
						row.TaxType = "SR";
						row.SubTotal = line.lineTotal ?? line.qty * (line.unitPrice ?? 0);

						return INVOICE_HEADERS.map((col) => row[col]);
					});

					const workbook = XLSX.utils.book_new();
					const sheetData = [[...INVOICE_HEADERS], ...dataRows];
					const sheet = XLSX.utils.aoa_to_sheet(sheetData);
					XLSX.utils.book_append_sheet(workbook, sheet, "Invoice");

					const fileBuffer = XLSX.write(workbook, {
						bookType: "xlsx",
						type: "buffer",
					});

					if (order.status === "confirmed") {
						markOrderExported(id);
					}

					const safeDate = order.docDate.replaceAll("/", "-");
					const filename = `order-${order.id}-${safeDate}.xlsx`;

					return new Response(fileBuffer, {
						headers: {
							"Content-Type":
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
							"Content-Disposition": `attachment; filename="${filename}"`,
							"Cache-Control": "no-store",
						},
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/orders/$id/export GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},
		},
	},
});
