import { describe, expect, it } from "vitest";
import { createMockTextMessage } from "../mock.ts";
import { extractTextMessages, type WhatsAppWebhookPayload } from "../types.ts";

describe("extractTextMessages", () => {
	it("extracts a single text message from a webhook payload", () => {
		const payload = createMockTextMessage({
			from: "6581234567",
			name: "Joseph FK Trading",
			body: "Lala 40/60 x 10 ctn",
		});

		const messages = extractTextMessages(payload);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toMatchObject({
			from: "6581234567",
			name: "Joseph FK Trading",
			body: "Lala 40/60 x 10 ctn",
		});
		expect(messages[0].messageId).toMatch(/^wamid\./);
		expect(messages[0].timestamp).toBeDefined();
	});

	it("returns empty array for status-only payloads (no messages)", () => {
		const payload: WhatsAppWebhookPayload = {
			object: "whatsapp_business_account",
			entry: [
				{
					id: "123",
					changes: [
						{
							value: {
								messaging_product: "whatsapp",
								metadata: {
									display_phone_number: "6591234567",
									phone_number_id: "106540352242922",
								},
								statuses: [
									{
										id: "wamid.test",
										status: "delivered",
										timestamp: "1234567890",
										recipient_id: "6581234567",
									},
								],
							},
							field: "messages",
						},
					],
				},
			],
		};

		const messages = extractTextMessages(payload);
		expect(messages).toHaveLength(0);
	});

	it("handles payload with no contacts gracefully", () => {
		const payload: WhatsAppWebhookPayload = {
			object: "whatsapp_business_account",
			entry: [
				{
					id: "123",
					changes: [
						{
							value: {
								messaging_product: "whatsapp",
								metadata: {
									display_phone_number: "6591234567",
									phone_number_id: "106540352242922",
								},
								messages: [
									{
										from: "6581234567",
										id: "wamid.test",
										timestamp: "1234567890",
										type: "text",
										text: { body: "Hello" },
									},
								],
							},
							field: "messages",
						},
					],
				},
			],
		};

		const messages = extractTextMessages(payload);
		expect(messages).toHaveLength(0);
	});

	it("ignores non-text message types", () => {
		const payload: WhatsAppWebhookPayload = {
			object: "whatsapp_business_account",
			entry: [
				{
					id: "123",
					changes: [
						{
							value: {
								messaging_product: "whatsapp",
								metadata: {
									display_phone_number: "6591234567",
									phone_number_id: "106540352242922",
								},
								contacts: [
									{
										profile: { name: "Test" },
										wa_id: "6581234567",
									},
								],
								messages: [
									{
										from: "6581234567",
										id: "wamid.test",
										timestamp: "1234567890",
										type: "image",
										image: {
											id: "img123",
											mime_type: "image/jpeg",
											sha256: "abc",
										},
									},
								],
							},
							field: "messages",
						},
					],
				},
			],
		};

		const messages = extractTextMessages(payload);
		expect(messages).toHaveLength(0);
	});

	it("extracts multiple messages from a single payload", () => {
		const payload: WhatsAppWebhookPayload = {
			object: "whatsapp_business_account",
			entry: [
				{
					id: "123",
					changes: [
						{
							value: {
								messaging_product: "whatsapp",
								metadata: {
									display_phone_number: "6591234567",
									phone_number_id: "106540352242922",
								},
								contacts: [
									{
										profile: { name: "Alice" },
										wa_id: "6581111111",
									},
									{
										profile: { name: "Bob" },
										wa_id: "6582222222",
									},
								],
								messages: [
									{
										from: "6581111111",
										id: "wamid.msg1",
										timestamp: "1234567890",
										type: "text",
										text: { body: "Order A" },
									},
									{
										from: "6582222222",
										id: "wamid.msg2",
										timestamp: "1234567891",
										type: "text",
										text: { body: "Order B" },
									},
								],
							},
							field: "messages",
						},
					],
				},
			],
		};

		const messages = extractTextMessages(payload);
		expect(messages).toHaveLength(2);
		expect(messages[0].name).toBe("Alice");
		expect(messages[0].body).toBe("Order A");
		expect(messages[1].name).toBe("Bob");
		expect(messages[1].body).toBe("Order B");
	});
});

describe("createMockTextMessage", () => {
	it("creates a valid webhook payload structure", () => {
		const payload = createMockTextMessage({
			from: "6581234567",
			name: "Test User",
			body: "Hello world",
		});

		expect(payload.object).toBe("whatsapp_business_account");
		expect(payload.entry).toHaveLength(1);
		expect(payload.entry[0].changes).toHaveLength(1);

		const change = payload.entry[0].changes[0];
		expect(change.field).toBe("messages");
		expect(change.value.messaging_product).toBe("whatsapp");
		expect(change.value.contacts).toHaveLength(1);
		expect(change.value.messages).toHaveLength(1);

		const msg = change.value.messages?.[0];
		expect(msg.from).toBe("6581234567");
		expect(msg.type).toBe("text");
		expect(msg.text?.body).toBe("Hello world");
	});

	it("uses provided timestamp when given", () => {
		const payload = createMockTextMessage({
			from: "6581234567",
			name: "Test",
			body: "Hi",
			timestamp: "1700000000",
		});

		const msg = payload.entry[0].changes[0].value.messages?.[0];
		expect(msg.timestamp).toBe("1700000000");
	});
});
