import { eq, like, or } from "drizzle-orm";
import { db } from "@/db/index";
import { debtors } from "@/db/schema";
import type { Debtor, NewDebtor } from "./types";

// ─── Filters ─────────────────────────────────────────────────────────────────

export type DebtorFilters = {
	isActive?: boolean;
	agent?: string;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/** List all debtors, optionally filtered by active status or agent. */
export function listDebtors(filters?: DebtorFilters): Debtor[] {
	let query = db.select().from(debtors).$dynamic();

	if (filters?.isActive !== undefined) {
		query = query.where(eq(debtors.isActive, filters.isActive));
	}
	if (filters?.agent) {
		query = query.where(eq(debtors.agent, filters.agent));
	}

	return query.all();
}

/** Get a single debtor by code (primary key). */
export function getDebtor(code: string): Debtor | undefined {
	return db.select().from(debtors).where(eq(debtors.code, code)).get();
}

/** Insert a new debtor. Returns the inserted row. */
export function createDebtor(data: NewDebtor): Debtor {
	return db.insert(debtors).values(data).returning().get();
}

/** Update a debtor by code. Returns the updated row or undefined if not found. */
export function updateDebtor(
	code: string,
	data: Partial<Omit<NewDebtor, "code">>,
): Debtor | undefined {
	return db
		.update(debtors)
		.set(data)
		.where(eq(debtors.code, code))
		.returning()
		.get();
}

/** Delete a debtor by code. Returns true if a row was deleted. */
export function deleteDebtor(code: string): boolean {
	const result = db.delete(debtors).where(eq(debtors.code, code)).run();
	return result.changes > 0;
}

/** Search debtors by company name, alias, or code (LIKE match). Returns top 20. */
export function searchDebtors(query: string): Debtor[] {
	const pattern = `%${query}%`;
	return db
		.select()
		.from(debtors)
		.where(
			or(
				like(debtors.companyName, pattern),
				like(debtors.alias, pattern),
				like(debtors.code, pattern),
			),
		)
		.limit(20)
		.all();
}
