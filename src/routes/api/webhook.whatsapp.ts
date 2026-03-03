import { createFileRoute } from "@tanstack/react-router";
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
			 * Extracts text messages and queues them for order parsing.
			 */
			POST: async ({ request }) => {
				const payload: WhatsAppWebhookPayload = await request.json();

				// Validate basic structure
				if (payload.object !== "whatsapp_business_account") {
					return new Response("Invalid payload", { status: 400 });
				}

				const textMessages = extractTextMessages(payload);

				if (textMessages.length === 0) {
					// Acknowledge non-text messages (status updates, etc.)
					return new Response(null, { status: 200 });
				}

				// TODO: Queue messages for AI order parsing (ORD-7)
				// For now, log and acknowledge
				console.log(
					`[WhatsApp] Received ${textMessages.length} text message(s):`,
					textMessages.map((m) => ({
						from: m.name,
						preview: m.body.substring(0, 50),
					})),
				);

				return Response.json({
					received: textMessages.length,
					messages: textMessages.map((m) => ({
						from: m.from,
						name: m.name,
						messageId: m.messageId,
						bodyPreview: m.body.substring(0, 100),
					})),
				});
			},
		},
	},
});
