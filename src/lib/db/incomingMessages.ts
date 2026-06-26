import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { incomingMessages } from "@/db/schema";
import type {
	IncomingMessage,
	IncomingMessageStatus,
	NewIncomingMessage,
} from "./types";

export type IncomingMessageFilters = {
	status?: IncomingMessageStatus;
};

export function listIncomingMessages(
	filters?: IncomingMessageFilters,
): IncomingMessage[] {
	let query = db
		.select()
		.from(incomingMessages)
		.orderBy(desc(incomingMessages.createdAt))
		.$dynamic();

	if (filters?.status) {
		query = query.where(eq(incomingMessages.status, filters.status));
	}

	return query.all();
}

export function getIncomingMessagesByIds(ids: number[]): IncomingMessage[] {
	if (ids.length === 0) return [];

	return db
		.select()
		.from(incomingMessages)
		.where(inArray(incomingMessages.id, ids))
		.orderBy(asc(incomingMessages.timestamp), asc(incomingMessages.id))
		.all();
}

export function createIncomingMessage(
	data: NewIncomingMessage,
): IncomingMessage | undefined {
	return db
		.insert(incomingMessages)
		.values(data)
		.onConflictDoNothing()
		.returning()
		.get();
}

export function markIncomingMessagesUsed(
	ids: number[],
	sourceOrderId: number,
): void {
	if (ids.length === 0) return;

	db.update(incomingMessages)
		.set({ status: "used", sourceOrderId })
		.where(inArray(incomingMessages.id, ids))
		.run();
}

export function deleteIncomingMessages(ids: number[]): number {
	if (ids.length === 0) return 0;

	const result = db
		.delete(incomingMessages)
		.where(
			and(
				inArray(incomingMessages.id, ids),
				eq(incomingMessages.status, "new"),
			),
		)
		.run();

	return result.changes;
}
