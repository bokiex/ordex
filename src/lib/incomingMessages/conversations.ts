type ConversationMessage = {
	id: number;
	conversationKey: string | null;
	timestamp: string;
	customerNameHint: string | null;
	senderName: string;
};

/** Keys are source-qualified and encoded as tuples to avoid delimiter collisions. */
export function groupConversationKey(groupJid: string): string {
	return JSON.stringify(["whatsapp-group", groupJid]);
}

export function metaConversationKey(
	accountId: string | undefined,
	phoneNumberId: string | undefined,
	sender: string | undefined,
): string | null {
	if (!accountId?.trim() || !phoneNumberId?.trim() || !sender?.trim()) {
		return null;
	}
	return JSON.stringify(["meta", accountId, phoneNumberId, sender]);
}

/** Unknown identities are isolated per message, never grouped by display name. */
export function conversationGroupingKey(message: ConversationMessage): string {
	return message.conversationKey
		? JSON.stringify(["known", message.conversationKey])
		: JSON.stringify(["unknown", message.id]);
}

/** Match the database's timestamp, then id ordering when choosing a name. */
export function latestConversationMessage<T extends ConversationMessage>(
	messages: T[],
): T | undefined {
	return messages.reduce<T | undefined>((latest, message) => {
		if (
			!latest ||
			message.timestamp > latest.timestamp ||
			(message.timestamp === latest.timestamp && message.id > latest.id)
		)
			return message;
		return latest;
	}, undefined);
}

export function conversationName(message: ConversationMessage): string {
	return message.customerNameHint || message.senderName;
}

export function groupIncomingMessages<T extends ConversationMessage>(
	messages: T[],
) {
	const groups = new Map<string, T[]>();
	for (const message of messages) {
		const key = conversationGroupingKey(message);
		const existing = groups.get(key);
		if (existing) existing.push(message);
		else groups.set(key, [message]);
	}
	return Array.from(groups, ([key, groupedMessages]) => {
		const latest = latestConversationMessage(groupedMessages);
		// Each group is created with at least one message.
		if (!latest) throw new Error("Empty conversation group");
		return {
			key,
			customerName: conversationName(latest),
			conversationKey: latest.conversationKey,
			messages: groupedMessages,
		};
	});
}

export function describeConversation(conversationKey: string | null): string {
	if (!conversationKey) return "Unknown conversation · message kept separate";
	try {
		const parts: unknown = JSON.parse(conversationKey);
		if (
			Array.isArray(parts) &&
			parts.every((part) => typeof part === "string")
		) {
			if (parts[0] === "whatsapp-group" && parts.length === 2) {
				return `WhatsApp group · ${parts[1]}`;
			}
			if (parts[0] === "meta" && parts.length === 4) {
				return `Meta · account ${parts[1]} · phone ${parts[2]} · sender ${parts[3]}`;
			}
		}
	} catch {
		// Keep malformed historical data distinct without interpreting it as a name.
	}
	return "WhatsApp conversation";
}
