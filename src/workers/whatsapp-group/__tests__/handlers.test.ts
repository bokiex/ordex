import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Client } from "whatsapp-web.js";
import {
	buildOrderRequest,
	extractSenderName,
	handleIncomingGroupMessage,
	type IncomingMessageLike,
	registerWhatsAppGroupMessageHandler,
	type WorkerLogger,
} from "../handlers.ts";

function createLogger(): WorkerLogger {
	return {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	};
}

function createMessage(
	overrides: Partial<IncomingMessageLike> = {},
): IncomingMessageLike {
	return {
		author: "6591111111@c.us",
		body: "Mee kia 3 pkt",
		fromMe: false,
		id: { _serialized: "wamid.test" },
		timestamp: 1_713_900_000,
		getChat: async () => ({
			isGroup: true,
			name: "Orders Group",
		}),
		getContact: async () => ({
			number: "6591111111",
			pushname: "Alice",
		}),
		...overrides,
	};
}

describe("extractSenderName", () => {
	it("prefers pushname before other contact fields", () => {
		expect(
			extractSenderName(
				{
					name: "Legal Name",
					number: "6591111111",
					pushname: "Alice Push",
					shortName: "Alice",
				},
				"6592222222@c.us",
			),
		).toBe("Alice Push");
	});

	it("falls back to the WhatsApp id when contact names are unavailable", () => {
		expect(extractSenderName({}, "6593333333@c.us")).toBe("6593333333");
	});
});

describe("buildOrderRequest", () => {
	it("uses the group name as customer hint and preserves the sender name", () => {
		expect(buildOrderRequest("hello", " Orders Group ", " Alice ")).toEqual({
			customerNameHint: "Orders Group",
			message: "hello",
			senderName: "Alice",
		});
		expect(buildOrderRequest("hello", "   ", "   ")).toEqual({
			message: "hello",
		});
	});
});

describe("handleIncomingGroupMessage", () => {
	it("skips self-authored messages by default", async () => {
		const fetchImpl = vi.fn<typeof fetch>();

		const result = await handleIncomingGroupMessage(
			createMessage({ fromMe: true }),
			{
				fetchImpl,
				logger: createLogger(),
				incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
			},
		);

		expect(result).toEqual({ status: "skipped", reason: "from_me" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("processes self-authored group messages when explicitly enabled", async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ message: { id: 43 } }), {
				status: 201,
			}),
		);

		const result = await handleIncomingGroupMessage(
			createMessage({ fromMe: true }),
			{
				fetchImpl,
				includeSelfMessages: true,
				logger: createLogger(),
				incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
			},
		);

		expect(result).toEqual({ status: "processed", incomingMessageId: 43 });
		expect(fetchImpl).toHaveBeenCalledOnce();
	});

	it("skips non-group messages", async () => {
		const fetchImpl = vi.fn<typeof fetch>();

		const result = await handleIncomingGroupMessage(
			createMessage({
				getChat: async () => ({
					isGroup: false,
					name: "Direct Chat",
				}),
			}),
			{
				fetchImpl,
				logger: createLogger(),
				incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
			},
		);

		expect(result).toEqual({ status: "skipped", reason: "not_group" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("posts group messages to the incoming messages api with sender metadata", async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ message: { id: 42 } }), {
				headers: {
					"Content-Type": "application/json",
				},
				status: 201,
			}),
		);
		const logger = createLogger();

		const result = await handleIncomingGroupMessage(createMessage(), {
			fetchImpl,
			logger,
			incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
		});

		expect(result).toEqual({ status: "processed", incomingMessageId: 42 });
		expect(fetchImpl).toHaveBeenCalledOnce();
		expect(fetchImpl.mock.calls[0]?.[0]).toBe(
			"http://localhost:3000/api/incoming-messages",
		);
		expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
			headers: {
				"Content-Type": "application/json",
			},
			method: "POST",
		});
		expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
			customerNameHint: "Orders Group",
			from: "6591111111",
			message: "Mee kia 3 pkt",
			senderName: "Alice",
			timestamp: "1713900000",
			whatsappMessageId: "wamid.test",
		});
		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("Orders Group"),
		);
	});

	it("subscribes to self-created messages only when enabled", () => {
		const disabledClient = new EventEmitter() as unknown as Client;
		const enabledClient = new EventEmitter() as unknown as Client;
		const options = {
			incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
			logger: createLogger(),
		};

		registerWhatsAppGroupMessageHandler(disabledClient, options);
		registerWhatsAppGroupMessageHandler(enabledClient, {
			...options,
			includeSelfMessages: true,
		});

		expect(disabledClient.listenerCount("message")).toBe(1);
		expect(disabledClient.listenerCount("message_create")).toBe(0);
		expect(enabledClient.listenerCount("message")).toBe(1);
		expect(enabledClient.listenerCount("message_create")).toBe(1);
	});

	it("skips empty group messages", async () => {
		const logger = createLogger();

		const result = await handleIncomingGroupMessage(
			createMessage({
				body: "   ",
			}),
			{
				fetchImpl: vi.fn<typeof fetch>(),
				logger,
				incomingMessagesEndpoint: "http://localhost:3000/api/incoming-messages",
			},
		);

		expect(result).toEqual({ status: "skipped", reason: "empty_body" });
		expect(logger.warn).toHaveBeenCalledWith(
			"[WhatsApp Group Worker] Skipping empty group message payload.",
		);
	});
});
