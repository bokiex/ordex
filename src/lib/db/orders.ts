import { desc, eq } from "drizzle-orm";
import { db } from "@/db/index";
import {
	debtors,
	incomingMessages,
	items,
	orderItems,
	orders,
} from "@/db/schema";
import { normalizeUom } from "@/lib/uom";
import type {
	NewOrder,
	NewOrderItem,
	Order,
	OrderItem,
	OrderStatus,
	OrderWithItems,
} from "./types";

// ─── Filters ─────────────────────────────────────────────────────────────────

export type OrderFilters = {
	status?: OrderStatus;
	debtorCode?: string;
};

// ─── List / Get ──────────────────────────────────────────────────────────────

/** List orders with debtor company name, newest first. */
export function listOrders(
	filters?: OrderFilters,
): (Order & { debtorCompanyName: string | null })[] {
	let query = db
		.select({
			id: orders.id,
			debtorCode: orders.debtorCode,
			debtorName: orders.debtorName,
			agent: orders.agent,
			docDate: orders.docDate,
			rawMessage: orders.rawMessage,
			status: orders.status,
			createdAt: orders.createdAt,
			debtorCompanyName: debtors.companyName,
		})
		.from(orders)
		.leftJoin(debtors, eq(orders.debtorCode, debtors.code))
		.orderBy(desc(orders.createdAt))
		.$dynamic();

	if (filters?.status) {
		query = query.where(eq(orders.status, filters.status));
	}
	if (filters?.debtorCode) {
		query = query.where(eq(orders.debtorCode, filters.debtorCode));
	}

	return query.all();
}

/** Get a full order with debtor info and all line items (with matched item data). */
export function getOrderWithItems(id: number): OrderWithItems | undefined {
	const order = db.select().from(orders).where(eq(orders.id, id)).get();

	if (!order) return undefined;

	const debtor = order.debtorCode
		? (db
				.select()
				.from(debtors)
				.where(eq(debtors.code, order.debtorCode))
				.get() ?? null)
		: null;

	const lineRows = db
		.select({
			id: orderItems.id,
			orderId: orderItems.orderId,
			itemCode: orderItems.itemCode,
			rawItemName: orderItems.rawItemName,
			description: orderItems.description,
			uom: orderItems.uom,
			qty: orderItems.qty,
			unitPrice: orderItems.unitPrice,
			lineTotal: orderItems.lineTotal,
			matched: orderItems.matched,
			// joined item columns
			itemObj_code: items.code,
			itemObj_description: items.description,
			itemObj_baseUom: items.baseUom,
			itemObj_uomCount: items.uomCount,
			itemObj_itemGroup: items.itemGroup,
			itemObj_isActive: items.isActive,
			itemObj_price: items.price,
		})
		.from(orderItems)
		.leftJoin(items, eq(orderItems.itemCode, items.code))
		.where(eq(orderItems.orderId, id))
		.all();

	const enrichedItems = lineRows.map((row) => {
		const uom = row.itemObj_baseUom
			? normalizeUom(row.itemObj_baseUom)
			: row.uom;
		const unitPrice = row.itemObj_price ?? row.unitPrice ?? null;

		return {
			id: row.id,
			orderId: row.orderId,
			itemCode: row.itemCode,
			rawItemName: row.rawItemName,
			description: row.description,
			uom,
			qty: row.qty,
			unitPrice,
			lineTotal:
				row.lineTotal ?? (unitPrice == null ? null : row.qty * unitPrice),
			matched: row.matched,
			item: row.itemObj_code
				? {
						code: row.itemObj_code,
						description: row.itemObj_description,
						baseUom: row.itemObj_baseUom,
						uomCount: row.itemObj_uomCount,
						itemGroup: row.itemObj_itemGroup,
						isActive: row.itemObj_isActive,
						price: row.itemObj_price,
					}
				: null,
		};
	});

	return {
		...order,
		debtor,
		items: enrichedItems,
	};
}

// ─── Create / Update / Delete ────────────────────────────────────────────────

/** Create an order with its line items in sequence. Returns the full order. */
export function createOrder(
	data: NewOrder,
	lineItems: Omit<NewOrderItem, "orderId">[],
): OrderWithItems {
	const order = db.insert(orders).values(data).returning().get();

	for (const line of lineItems) {
		db.insert(orderItems)
			.values({ ...line, orderId: order.id })
			.run();
	}

	// biome-ignore lint/style/noNonNullAssertion: just inserted
	return getOrderWithItems(order.id)!;
}

/** Update order header fields. Returns the updated row or undefined. */
export function updateOrder(
	id: number,
	data: Partial<Omit<NewOrder, "id">>,
): Order | undefined {
	return db.update(orders).set(data).where(eq(orders.id, id)).returning().get();
}

/** Delete an order and restore its source messages to the incoming queue. */
export function deleteOrder(id: number): {
	deleted: boolean;
	releasedMessageIds: number[];
} {
	return db.transaction((tx) => {
		const sourceMessages = tx
			.select({ id: incomingMessages.id })
			.from(incomingMessages)
			.where(eq(incomingMessages.sourceOrderId, id))
			.all();

		if (sourceMessages.length > 0) {
			tx.update(incomingMessages)
				.set({ sourceOrderId: null, status: "new" })
				.where(eq(incomingMessages.sourceOrderId, id))
				.run();
		}

		tx.delete(orderItems).where(eq(orderItems.orderId, id)).run();
		const result = tx.delete(orders).where(eq(orders.id, id)).run();

		return {
			deleted: result.changes > 0,
			releasedMessageIds: sourceMessages.map((message) => message.id),
		};
	});
}

/** Set order status to 'confirmed'. */
export function confirmOrder(id: number): Order | undefined {
	return db.transaction((tx) => {
		const matchedLines = tx
			.select({
				id: orderItems.id,
				qty: orderItems.qty,
				baseUom: items.baseUom,
				price: items.price,
			})
			.from(orderItems)
			.innerJoin(items, eq(orderItems.itemCode, items.code))
			.where(eq(orderItems.orderId, id))
			.all();

		for (const line of matchedLines) {
			tx.update(orderItems)
				.set({
					uom: normalizeUom(line.baseUom),
					unitPrice: line.price,
					lineTotal: line.price == null ? null : line.qty * line.price,
				})
				.where(eq(orderItems.id, line.id))
				.run();
		}

		return tx
			.update(orders)
			.set({ status: "confirmed" })
			.where(eq(orders.id, id))
			.returning()
			.get();
	});
}

/** Set order status to 'exported'. */
export function markOrderExported(id: number): Order | undefined {
	return db
		.update(orders)
		.set({ status: "exported" })
		.where(eq(orders.id, id))
		.returning()
		.get();
}

// ─── Order Items ─────────────────────────────────────────────────────────────

/** Add a single line item to an existing order. */
export function addOrderItem(
	orderId: number,
	data: Omit<NewOrderItem, "orderId">,
): OrderItem {
	return db
		.insert(orderItems)
		.values({ ...data, orderId })
		.returning()
		.get();
}

/** Update an order line item. Returns updated row or undefined. */
export function updateOrderItem(
	id: number,
	data: Partial<Omit<NewOrderItem, "id" | "orderId">>,
): OrderItem | undefined {
	return db
		.update(orderItems)
		.set(data)
		.where(eq(orderItems.id, id))
		.returning()
		.get();
}

/** Delete an order line item. Returns true if deleted. */
export function deleteOrderItem(id: number): boolean {
	const result = db.delete(orderItems).where(eq(orderItems.id, id)).run();
	return result.changes > 0;
}
