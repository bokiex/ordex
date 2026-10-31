import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import {
	createIncomingMessage,
	deleteIncomingMessages,
	getIncomingMessagesByIds,
	listIncomingMessages,
} from "@/lib/db/incomingMessages";
import {
	publishIncomingMessage,
	publishIncomingMessagesChanged,
} from "@/lib/events/incomingMessages";
import { groupConversationKey } from "@/lib/incomingMessages/conversations";
import { createOrderFromSelectedMessages } from "@/lib/orders";

export const Route = createFileRoute("/api/incoming-messages")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const status = url.searchParams.get("status");

					if (status != null && status !== "new" && status !== "used") {
						return Response.json(
							{ error: "Invalid 'status' query parameter" },
							{ status: 400 },
						);
					}

					const data = listIncomingMessages(
						status ? { status: status as "new" | "used" } : undefined,
					);
					return Response.json(data);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					console.error("[API /api/incoming-messages GET] Error:", message);
					return Response.json(
						{ error: `Internal server error: ${message}` },
						{ status: 500 },
					);
				}
			},

			POST: async ({ request }) => {
				const body = await request.json();

				if (typeof body.message === "string") {
					const trimmedMessage = body.message.trim();
					if (!trimmedMessage) {
						return Response.json(
							{ error: "Missing or invalid 'message' field" },
							{ status: 400 },
						);
					}

					if (
						body.groupJid != null &&
						(typeof body.groupJid !== "string" ||
							!/^[^@\s]+@g\.us$/.test(body.groupJid))
					) {
						return Response.json(
							{ error: "Invalid 'groupJid' field" },
							{ status: 400 },
						);
					}

					const senderName =
						typeof body.senderName === "string" && body.senderName.trim()
							? body.senderName.trim()
							: typeof body.customerNameHint === "string" &&
									body.customerNameHint.trim()
								? body.customerNameHint.trim()
								: "Unknown Sender";
					const customerNameHint =
						typeof body.customerNameHint === "string" &&
						body.customerNameHint.trim()
							? body.customerNameHint.trim()
							: senderName;
					const from =
						typeof body.from === "string" && body.from.trim()
							? body.from.trim()
							: senderName;
					const timestamp =
						typeof body.timestamp === "string" && body.timestamp.trim()
							? body.timestamp.trim()
							: Math.floor(Date.now() / 1_000).toString();
					const whatsappMessageId =
						typeof body.whatsappMessageId === "string" &&
						body.whatsappMessageId.trim()
							? body.whatsappMessageId.trim()
							: buildMessageFingerprint(
									from,
									timestamp,
									trimmedMessage,
									body.groupJid,
								);

					const message = createIncomingMessage({
						from,
						senderName,
						customerNameHint,
						conversationKey: body.groupJid
							? groupConversationKey(body.groupJid)
							: null,
						whatsappMessageId,
						timestamp,
						body: trimmedMessage,
					});

					if (message) {
						publishIncomingMessage({
							id: message.id,
							from: message.from,
							senderName: message.senderName,
							createdAt: message.createdAt,
						});
					}

					return Response.json(
						{
							message: message ?? null,
							duplicate: !message,
						},
						{ status: message ? 201 : 200 },
					);
				}

				if (
					!Array.isArray(body.messageIds) ||
					body.messageIds.length === 0 ||
					body.messageIds.some((id: unknown) => !Number.isInteger(id))
				) {
					return Response.json(
						{ error: "Missing or invalid 'messageIds' field" },
						{ status: 400 },
					);
				}

				const result = await createOrderFromSelectedMessages(body.messageIds);

				if (!result.success) {
					if (result.stage === "selection" || result.stage === "group") {
						return Response.json(
							{ error: result.error },
							{ status: result.stage === "selection" ? 409 : 400 },
						);
					}
					if (result.stage === "parse") {
						console.error(
							"[API /api/incoming-messages POST] Ollama error:",
							result.error,
						);
						return Response.json(
							{ error: `Failed to parse order: ${result.error}` },
							{ status: 502 },
						);
					}

					console.error(
						"[API /api/incoming-messages POST] Error:",
						result.error,
					);
					return Response.json(
						{ error: `Internal server error: ${result.error}` },
						{ status: 500 },
					);
				}

				return Response.json(result.order, { status: 201 });
			},
			DELETE: async ({ request }) => {
				const body = await request.json();
				if (
					!Array.isArray(body.messageIds) ||
					body.messageIds.length === 0 ||
					body.messageIds.some((id: unknown) => !Number.isInteger(id))
				) {
					return Response.json(
						{ error: "Missing or invalid 'messageIds' field" },
						{ status: 400 },
					);
				}

				const messageIds = [...new Set(body.messageIds as number[])];
				const messages = getIncomingMessagesByIds(messageIds).filter(
					(message) => message.status === "new",
				);
				if (messages.length !== messageIds.length) {
					return Response.json(
						{ error: "One or more selected messages are unavailable" },
						{ status: 409 },
					);
				}

				const deleted = deleteIncomingMessages(messageIds);
				if (deleted !== messageIds.length) {
					return Response.json(
						{ error: "One or more selected messages are unavailable" },
						{ status: 409 },
					);
				}

				publishIncomingMessagesChanged({
					action: "deleted",
					ids: messageIds,
				});
				return new Response(null, { status: 204 });
			},
		},
	},
});

function buildMessageFingerprint(
	from: string,
	timestamp: string,
	message: string,
	groupJid?: string,
): string {
	const hash = createHash("sha256")
		.update(
			`${groupJid ? `${groupJid}\n` : ""}${from}\n${timestamp}\n${message}`,
		)
		.digest("hex");
	return `worker:${hash}`;
}
