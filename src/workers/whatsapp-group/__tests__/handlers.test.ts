import { describe, expect, it, vi } from "vitest";
import {
	buildOrderRequest,
	extractSenderName,
	handleIncomingGroupMessage,
	type IncomingMessageLike,
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
	it("includes customerNameHint only when the sender name is present", () => {
		expect(buildOrderRequest("hello", " Alice ")).toEqual({
			customerNameHint: "Alice",
			message: "hello",
		});
		expect(buildOrderRequest("hello", "   ")).toEqual({
			message: "hello",
		});
	});
});

describe("handleIncomingGroupMessage", () => {
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
			customerNameHint: "Alice",
			from: "6591111111",
			message: "Mee kia 3 pkt",
			timestamp: "1713900000",
			whatsappMessageId: "wamid.test",
		});
		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("Orders Group"),
		);
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
