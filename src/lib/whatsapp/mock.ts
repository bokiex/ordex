/**
 * Mock WhatsApp webhook payloads for development and testing.
 *
 * These match the exact structure of real Meta WhatsApp Cloud API webhook payloads.
 */

import type { WhatsAppWebhookPayload } from "./types.ts";

const MOCK_BUSINESS_ACCOUNT_ID = "102290129340398";
const MOCK_PHONE_NUMBER_ID = "106540352242922";
const MOCK_DISPLAY_PHONE = "6591234567"; // SG business number

/** Generate a unique-ish message ID in WhatsApp format */
function mockMessageId(): string {
	const random = Math.random().toString(36).substring(2, 15);
	return `wamid.HBgL${random.toUpperCase()}`;
}

/** Create a mock incoming text message webhook payload */
export function createMockTextMessage(opts: {
	from: string;
	name: string;
	body: string;
	timestamp?: string;
}): WhatsAppWebhookPayload {
	const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000).toString();

	return {
		object: "whatsapp_business_account",
		entry: [
			{
				id: MOCK_BUSINESS_ACCOUNT_ID,
				changes: [
					{
						value: {
							messaging_product: "whatsapp",
							metadata: {
								display_phone_number: MOCK_DISPLAY_PHONE,
								phone_number_id: MOCK_PHONE_NUMBER_ID,
							},
							contacts: [
								{
									profile: { name: opts.name },
									wa_id: opts.from,
								},
							],
							messages: [
								{
									from: opts.from,
									id: mockMessageId(),
									timestamp,
									type: "text",
									text: { body: opts.body },
								},
							],
						},
						field: "messages",
					},
				],
			},
		],
	};
}

// ─── Sample Order Messages (realistic WhatsApp order texts) ──────────────────

export const SAMPLE_ORDER_MESSAGES = [
	{
		from: "6581234567",
		name: "Joseph FK Trading",
		body: `Hi, pls send tomorrow:
- Lala 40/60 x 10 ctn
- Sotong ball x 5 pkt
- Fish cake 500g x 20
- White clam x 3 ctn
Thank you`,
	},
	{
		from: "6589876543",
		name: "Ah Seng Seafood",
		body: `Order for 3/3:
Lala 40/60 - 15ctn
Prawn 31/40 - 8ctn
Crab stick - 10pkt
Squid tube - 5kg`,
	},
	{
		from: "6582345678",
		name: "Kim Huat",
		body: `bro need tmr morning
lala 4060 x20
sotong ball x10
fishcake x15
tks`,
	},
] as const;

/** Create mock payloads for all sample messages */
export function createAllSamplePayloads(): WhatsAppWebhookPayload[] {
	return SAMPLE_ORDER_MESSAGES.map((msg) =>
		createMockTextMessage({
			from: msg.from,
			name: msg.name,
			body: msg.body,
		}),
	);
}
