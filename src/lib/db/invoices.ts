import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/index";
import { invoiceHistory } from "@/db/schema";
import type { InvoiceGroup, InvoiceHistoryLine } from "./types";

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
