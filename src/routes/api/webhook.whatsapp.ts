import { createFileRoute } from "@tanstack/react-router";
import { searchDebtors } from "@/lib/db/debtors";
import { getDebtorItemPreferences } from "@/lib/db/invoices";
import { createOrder } from "@/lib/db/orders";
import { matchItem } from "@/lib/matcher/index";
import { parseOrderMessage } from "@/lib/parser/index";
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
					try {
						// 1. Parse the order message with AI
						const today = new Date().toISOString().split("T")[0];
						const parsed = await parseOrderMessage(msg.body, today);

						// 2. Match customer — use WhatsApp contact name or parsed name
						const customerName = parsed.customerName || msg.name || null;
						let debtorCode: string | null = null;
						let debtorName = customerName || "Unknown";
						let agent: string | null = null;

						if (customerName) {
							const matchedDebtors = searchDebtors(customerName);
							if (matchedDebtors.length > 0) {
								debtorCode = matchedDebtors[0].code;
								debtorName = matchedDebtors[0].companyName;
								agent = matchedDebtors[0].agent;
							}
						}

						// 3. Load customer preferences from invoice history
						const preferences = debtorCode
							? getDebtorItemPreferences(debtorCode)
							: [];

						const docDate = parsed.deliveryDate || today;

						// 4. Match items using customer history
						const lineItems = parsed.items.map((item) => {
							const match = matchItem(item.itemName, preferences);
							const unitPrice = match?.unitPrice ?? null;
							return {
								itemCode: match?.itemCode ?? null,
								rawItemName: item.rawText,
								description: match?.description ?? item.itemName,
								uom: item.uom || match?.uom || null,
								qty: item.qty,
								unitPrice,
								lineTotal: unitPrice != null ? unitPrice * item.qty : null,
								matched: !!match,
							};
						});

						// 5. Create draft order
						const order = createOrder(
							{
								debtorCode,
								debtorName,
								agent,
								docDate,
								rawMessage: msg.body,
								status: "draft",
							},
							lineItems,
						);

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
					} catch (e) {
						const errMsg = e instanceof Error ? e.message : "Unknown error";
						console.error(
							`[WhatsApp] Failed to parse message from ${msg.name} (${msg.from}):`,
							errMsg,
						);
						results.push({
							from: msg.from,
							name: msg.name,
							messageId: msg.messageId,
							error: errMsg,
						});
					}
				}

				return Response.json({
					received: textMessages.length,
					orders: results,
				});
			},
		},
	},
});
