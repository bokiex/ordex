import { describe, expect, it } from "vitest";
import {
	conversationGroupingKey,
	groupConversationKey,
	groupIncomingMessages,
	metaConversationKey,
} from "../conversations";

describe("conversation identity", () => {
	it("scopes Meta identities to account, receiving phone and sender", () => {
		const original = metaConversationKey("account", "phone", "sender");
		expect(original).not.toBe(metaConversationKey("other", "phone", "sender"));
		expect(original).not.toBe(
			metaConversationKey("account", "other", "sender"),
		);
		expect(original).not.toBe(metaConversationKey("account", "phone", "other"));
		expect(metaConversationKey("", "phone", "sender")).toBeNull();
		expect(metaConversationKey("account", undefined, "sender")).toBeNull();
		expect(metaConversationKey("account", "phone", "")).toBeNull();
	});

	it("uses timestamp and ID, not arrival order, for group display names", () => {
		const key = groupConversationKey("1@g.us");
		const messages = [
			{
				id: 3,
				timestamp: "100",
				conversationKey: key,
				customerNameHint: "Newer ID",
				senderName: "Sender",
			},
			{
				id: 2,
				timestamp: "200",
				conversationKey: key,
				customerNameHint: "Newest",
				senderName: "Sender",
			},
			{
				id: 1,
				timestamp: "200",
				conversationKey: key,
				customerNameHint: "Older ID",
				senderName: "Sender",
			},
		];
		expect(groupIncomingMessages(messages)).toMatchObject([
			{ customerName: "Newest" },
		]);
	});

	it("isolates missing identities even when names and timestamps match", () => {
		const first = {
			id: 1,
			timestamp: "100",
			conversationKey: null,
			customerNameHint: "Same",
			senderName: "Same",
		};
		const second = { ...first, id: 2 };
		expect(conversationGroupingKey(first)).not.toBe(
			conversationGroupingKey(second),
		);
		expect(groupIncomingMessages([first, second])).toHaveLength(2);
	});
});
