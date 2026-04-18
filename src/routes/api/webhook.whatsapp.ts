import { createFileRoute } from "@tanstack/react-router";
import { createOrderFromMessage } from "@/lib/orders";
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
			 * Extracts text messages, parses them with AI, matches items
			 * using customer invoice history, and creates draft orders.
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
					const result = await createOrderFromMessage({
						message: msg.body,
						customerNameHint: msg.name,
					});

					if (!result.success) {
						console.error(
							`[WhatsApp] Failed to ${result.stage} message from ${msg.name} (${msg.from}):`,
							result.error,
						);
						results.push({
							from: msg.from,
							name: msg.name,
							messageId: msg.messageId,
							error: result.error,
						});
						continue;
					}

					const order = result.order;

					results.push({
						from: msg.from,
						name: msg.name,
						messageId: msg.messageId,
						orderId: order.id,
						itemCount: order.items.length,
						matched: order.items.filter((i) => i.matched).length,
					});

					console.log(
						`[WhatsApp] Created order #${order.id} from ${msg.name} (${msg.from}): ${order.items.length} items, ${order.items.filter((i) => i.matched).length} matched`,
					);
				}

				return Response.json({
					received: textMessages.length,
					orders: results,
				});
			},
		},
	},
});
