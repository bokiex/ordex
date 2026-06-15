import { createFileRoute } from "@tanstack/react-router";
import { createIncomingMessage } from "@/lib/db/incomingMessages";
import { publishIncomingMessage } from "@/lib/events/incomingMessages";
import {
	extractTextMessages,
	type WhatsAppWebhookPayload,
} from "@/lib/whatsapp/index.ts";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "ordex-dev-token";

export const Route = createFileRoute("/api/webhook/whatsapp")({
	server: {
		handlers: {
			/**
			 * Webhook verification (GET)
			 *
			 * Meta sends this when you register/edit a webhook URL.
			 * Must return the hub.challenge value if token matches.
			 */
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const mode = url.searchParams.get("hub.mode");
				const token = url.searchParams.get("hub.verify_token");
				const challenge = url.searchParams.get("hub.challenge");

				if (mode === "subscribe" && token === VERIFY_TOKEN) {
					return new Response(challenge ?? "", { status: 200 });
				}

				return new Response("Forbidden", { status: 403 });
			},

			/**
			 * Incoming message handler (POST)
			 *
			 * Receives webhook events from WhatsApp Cloud API.
			 * Extracts text messages and stores them for review/order generation.
			 */
			POST: async ({ request }) => {
				const payload: WhatsAppWebhookPayload = await request.json();

				if (payload.object !== "whatsapp_business_account") {
					return new Response("Invalid payload", { status: 400 });
				}

				const textMessages = extractTextMessages(payload);

				if (textMessages.length === 0) {
					return new Response(null, { status: 200 });
				}

				const results = [];

				for (const msg of textMessages) {
					const message = createIncomingMessage({
						from: msg.from,
						senderName: msg.name,
						whatsappMessageId: msg.messageId,
						timestamp: msg.timestamp,
						body: msg.body,
					});

					if (message) {
						publishIncomingMessage({
							id: message.id,
							from: message.from,
							senderName: message.senderName,
							createdAt: message.createdAt,
						});
					}

					results.push({
						from: msg.from,
						name: msg.name,
						messageId: msg.messageId,
						incomingMessageId: message?.id ?? null,
						duplicate: !message,
					});

					console.log(
						`[WhatsApp] Stored incoming message from ${msg.name} (${msg.from})`,
					);
				}

				return Response.json({
					received: textMessages.length,
					messages: results,
				});
			},
		},
	},
});
