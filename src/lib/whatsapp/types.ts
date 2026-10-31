/**
 * WhatsApp Cloud API Webhook Types
 *
 * Based on the official Meta WhatsApp Business Platform Cloud API documentation.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

// ─── Incoming Webhook Payload ────────────────────────────────────────────────

export interface WhatsAppWebhookPayload {
	object: "whatsapp_business_account";
	entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
	id: string; // WhatsApp Business Account ID
	changes: WhatsAppChange[];
}

export interface WhatsAppChange {
	value: WhatsAppChangeValue;
	field: "messages";
}

export interface WhatsAppChangeValue {
	messaging_product: "whatsapp";
	metadata: WhatsAppMetadata;
	contacts?: WhatsAppContact[];
	messages?: WhatsAppMessage[];
	statuses?: WhatsAppStatus[];
}

export interface WhatsAppMetadata {
	display_phone_number: string;
	phone_number_id: string;
}

export interface WhatsAppContact {
	profile: {
		name: string;
	};
	wa_id: string;
}

// ─── Message Types ───────────────────────────────────────────────────────────

export type WhatsAppMessageType =
	| "text"
	| "image"
	| "audio"
	| "video"
	| "document"
	| "location"
	| "contacts"
	| "interactive"
	| "order"
	| "system"
	| "sticker"
	| "reaction"
	| "button";

export interface WhatsAppMessage {
	from: string; // Sender's phone number
	id: string; // Unique message ID (wamid.*)
	timestamp: string; // Unix timestamp as string
	type: WhatsAppMessageType;
	text?: { body: string };
	image?: WhatsAppMedia;
	audio?: WhatsAppMedia;
	video?: WhatsAppMedia;
	document?: WhatsAppMedia & { filename?: string };
	location?: WhatsAppLocation;
	contacts?: WhatsAppContactMessage[];
	interactive?: WhatsAppInteractive;
	context?: WhatsAppContext;
}

export interface WhatsAppMedia {
	id: string;
	mime_type: string;
	sha256: string;
	caption?: string;
}

export interface WhatsAppLocation {
	latitude: number;
	longitude: number;
	name?: string;
	address?: string;
}

export interface WhatsAppContactMessage {
	name: {
		formatted_name: string;
		first_name?: string;
		last_name?: string;
	};
	phones?: Array<{ phone: string; type: string }>;
}

export interface WhatsAppInteractive {
	type: "button_reply" | "list_reply";
	button_reply?: { id: string; title: string };
	list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppContext {
	from: string; // Phone number of the message being replied to
	id: string; // Message ID being replied to
}

// ─── Status Updates ──────────────────────────────────────────────────────────

export interface WhatsAppStatus {
	id: string;
	status: "sent" | "delivered" | "read" | "failed" | "deleted" | "warning";
	timestamp: string;
	recipient_id: string;
	errors?: WhatsAppError[];
}

export interface WhatsAppError {
	code: number;
	title: string;
	message: string;
	error_data?: { details: string };
}

// ─── Webhook Verification ────────────────────────────────────────────────────

export interface WebhookVerifyQuery {
	"hub.mode": string;
	"hub.verify_token": string;
	"hub.challenge": string;
}

// ─── Helper to extract text messages from a webhook payload ──────────────────

export function extractTextMessages(payload: WhatsAppWebhookPayload): Array<{
	businessAccountId?: string;
	phoneNumberId?: string;
	from: string;
	name: string;
	messageId: string;
	timestamp: string;
	body: string;
}> {
	const results: Array<{
		businessAccountId?: string;
		phoneNumberId?: string;
		from: string;
		name: string;
		messageId: string;
		timestamp: string;
		body: string;
	}> = [];

	for (const entry of payload.entry) {
		for (const change of entry.changes) {
			const { contacts, messages } = change.value;
			if (!messages) continue;

			const contactMap = new Map(
				(contacts ?? []).map((c) => [c.wa_id, c.profile.name]),
			);

			for (const msg of messages) {
				if (msg.type === "text" && msg.text?.body) {
					results.push({
						businessAccountId: entry.id,
						phoneNumberId: change.value.metadata?.phone_number_id,
						from: msg.from,
						name: contactMap.get(msg.from) ?? msg.from,
						messageId: msg.id,
						timestamp: msg.timestamp,
						body: msg.text.body,
					});
				}
			}
		}
	}

	return results;
}
