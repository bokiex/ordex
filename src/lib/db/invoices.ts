import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/index";
import { invoiceHistory } from "@/db/schema";
import type { InvoiceGroup, InvoiceHistoryLine } from "./types";

/** An item code this debtor has ordered before, ranked by frequency. */
export type DebtorItemPreference = {
	itemCode: string;
	description: string;
	uom: string;
	lastUnitPrice: number;
	orderCount: number;
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export type InvoiceFilters = {
	debtorCode?: string;
	fromDate?: string; // ISO date
	toDate?: string; // ISO date
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Group flat invoice lines into InvoiceGroup objects keyed by docNo. */
function groupLines(lines: InvoiceHistoryLine[]): InvoiceGroup[] {
	const map = new Map<string, InvoiceGroup>();

	for (const line of lines) {
		let group = map.get(line.docNo);
		if (!group) {
			group = {
				docNo: line.docNo,
				docDate: line.docDate,
				debtorCode: line.debtorCode,
				debtorName: line.debtorName,
				agent: line.agent,
				lines: [],
				totalLines: 0,
				grandTotal: 0,
			};
			map.set(line.docNo, group);
		}
		group.lines.push(line);
		group.totalLines += 1;
		group.grandTotal += line.totalInc ?? line.lineTotal ?? 0;
	}

	return Array.from(map.values());
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** List invoice groups, optionally filtered by debtor or date range. */
export function listInvoiceGroups(filters?: InvoiceFilters): InvoiceGroup[] {
	const conditions = [];

	if (filters?.debtorCode) {
		conditions.push(eq(invoiceHistory.debtorCode, filters.debtorCode));
	}
	if (filters?.fromDate) {
		conditions.push(gte(invoiceHistory.docDate, filters.fromDate));
	}
	if (filters?.toDate) {
		conditions.push(lte(invoiceHistory.docDate, filters.toDate));
	}

	const rows =
		conditions.length > 0
			? db
					.select()
					.from(invoiceHistory)
					.where(and(...conditions))
					.all()
			: db.select().from(invoiceHistory).all();

	return groupLines(rows);
}

/** Get a single invoice group by document number. */
export function getInvoiceGroup(docNo: string): InvoiceGroup | undefined {
	const rows = db
		.select()
		.from(invoiceHistory)
		.where(eq(invoiceHistory.docNo, docNo))
		.all();

	if (rows.length === 0) return undefined;

	return groupLines(rows)[0];
}

/**
 * Get item preferences for a debtor based on invoice history.
 *
 * Returns item codes this customer has ordered, ranked by frequency (most ordered first).
 * Includes the most recent unit price for each item.
 */
export function getDebtorItemPreferences(
	debtorCode: string,
): DebtorItemPreference[] {
	const rows = db
		.select({
			itemCode: invoiceHistory.itemCode,
			description: invoiceHistory.description,
			uom: invoiceHistory.uom,
			orderCount: count(invoiceHistory.id),
		})
		.from(invoiceHistory)
		.where(eq(invoiceHistory.debtorCode, debtorCode))
		.groupBy(invoiceHistory.itemCode)
		.orderBy(desc(count(invoiceHistory.id)))
		.all();

	// For each item, get the most recent unit price
	return rows.map((row) => {
		const latest = db
			.select({ unitPrice: invoiceHistory.unitPrice })
			.from(invoiceHistory)
			.where(
				and(
					eq(invoiceHistory.debtorCode, debtorCode),
					eq(invoiceHistory.itemCode, row.itemCode),
				),
			)
			.orderBy(desc(invoiceHistory.docDate))
			.limit(1)
			.get();

		return {
			itemCode: row.itemCode,
			description: row.description,
			uom: row.uom,
			lastUnitPrice: latest?.unitPrice ?? 0,
			orderCount: row.orderCount,
		};
	});
}
