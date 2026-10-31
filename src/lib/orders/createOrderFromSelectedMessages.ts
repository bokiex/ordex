import { getIncomingMessagesByIds } from "@/lib/db/incomingMessages";
import { createOrderFromIncomingMessages } from "@/lib/db/orders";
import type { OrderWithItems } from "@/lib/db/types";
import {
	publishIncomingMessagesChanged,
	publishOrdersChanged,
} from "@/lib/events/incomingMessages";
import {
	conversationGroupingKey,
	conversationName,
	latestConversationMessage,
} from "@/lib/incomingMessages/conversations";
import { prepareOrderFromMessage } from "./createOrderFromMessage";

export type SelectedMessagesResult =
	| { success: true; order: OrderWithItems }
	| {
			success: false;
			error: string;
			stage: "selection" | "group" | "parse" | "create";
	  };

/** Generate a draft without holding a database transaction during parsing. */
export async function createOrderFromSelectedMessages(
	selectedIds: number[],
): Promise<SelectedMessagesResult> {
	const messageIds = [...new Set(selectedIds)];
	const messages = getIncomingMessagesByIds(messageIds).filter(
		(message) => message.status === "new",
	);
	if (messageIds.length === 0 || messages.length !== messageIds.length) {
		return {
			success: false,
			stage: "selection",
			error: "One or more selected messages are unavailable",
		};
	}

	const customerGroups = new Set(messages.map(conversationGroupingKey));
	if (customerGroups.size > 1) {
		return {
			success: false,
			stage: "group",
			error:
				"Selected messages must be from the same known conversation; messages with unknown identity must be selected individually",
		};
	}

	const latest = latestConversationMessage(messages);
	const prepared = await prepareOrderFromMessage({
		message: messages.map((message) => message.body).join("\n"),
		customerNameHint: latest ? conversationName(latest) : undefined,
	});
	if (!prepared.success) return prepared;

	let order: OrderWithItems | null;
	try {
		order = createOrderFromIncomingMessages(
			prepared.prepared.order,
			prepared.prepared.lineItems,
			messageIds,
		);
	} catch (error) {
		return {
			success: false,
			stage: "create",
			error: error instanceof Error ? error.message : "Unknown",
		};
	}
	if (!order) {
		return {
			success: false,
			stage: "selection",
			error: "One or more selected messages are unavailable",
		};
	}

	publishIncomingMessagesChanged({ action: "used", ids: messageIds });
	publishOrdersChanged({ action: "created", orderId: order.id });
	return { success: true, order };
}
