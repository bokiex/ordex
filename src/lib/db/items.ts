import { eq, like, or } from "drizzle-orm";
import { db } from "@/db/index";
import { items } from "@/db/schema";
import type { Item, NewItem } from "./types";

// ─── Filters ─────────────────────────────────────────────────────────────────

export type ItemFilters = {
	itemGroup?: string;
	isActive?: boolean;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/** List all items, optionally filtered by group or active status. */
export function listItems(filters?: ItemFilters): Item[] {
	let query = db.select().from(items).$dynamic();

	if (filters?.itemGroup) {
		query = query.where(eq(items.itemGroup, filters.itemGroup));
	}
	if (filters?.isActive !== undefined) {
		query = query.where(eq(items.isActive, filters.isActive));
	}

	return query.all();
}

/** Get a single item by its code (primary key). */
export function getItem(code: string): Item | undefined {
	return db.select().from(items).where(eq(items.code, code)).get();
}

/** Insert a new item. Returns the inserted row. */
export function createItem(data: NewItem): Item {
	return db.insert(items).values(data).returning().get();
}

/** Update an item by code. Returns the updated row or undefined if not found. */
export function updateItem(
	code: string,
	data: Partial<Omit<NewItem, "code">>,
): Item | undefined {
	return db
		.update(items)
		.set(data)
		.where(eq(items.code, code))
		.returning()
		.get();
}

/** Delete an item by code. Returns true if a row was deleted. */
export function deleteItem(code: string): boolean {
	const result = db.delete(items).where(eq(items.code, code)).run();
	return result.changes > 0;
}

/** Search items by code or description (LIKE match). Returns top 20. */
export function searchItems(query: string): Item[] {
	const pattern = `%${query}%`;
	return db
		.select()
		.from(items)
		.where(or(like(items.code, pattern), like(items.description, pattern)))
		.limit(20)
		.all();
}
