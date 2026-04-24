import type { Client, Contact, Message } from "whatsapp-web.js";

export type WorkerLogger = Pick<typeof console, "error" | "info" | "warn">;

type ChatLike = {
	isGroup: boolean;
	name?: string;
};

type ContactLike = Partial<
	Pick<Contact, "name" | "number" | "pushname" | "shortName">
>;

export type IncomingMessageLike = Pick<
	Message,
	"author" | "body" | "fromMe"
> & {
	timestamp: number;
	getChat(): Promise<ChatLike>;
	getContact(): Promise<ContactLike>;
};

export type GroupMessageHandlerOptions = {
	ordersEndpoint: string;
	fetchImpl?: typeof fetch;
	logger?: WorkerLogger;
};

export type GroupMessageResult =
	| { status: "processed"; orderId?: number }
	| { status: "skipped"; reason: "empty_body" | "from_me" | "not_group" };

export function extractSenderName(
	contact: ContactLike | null | undefined,
	fallbackId?: string,
): string {
	return (
		contact?.pushname?.trim() ||
		contact?.name?.trim() ||
		contact?.shortName?.trim() ||
		contact?.number?.trim() ||
		normalizeWhatsAppId(fallbackId) ||
		"Unknown Sender"
	);
}

export function formatWhatsAppTimestamp(timestamp: number): string {
	return new Date(timestamp * 1_000).toISOString();
}

export function buildOrderRequest(
	message: string,
	senderName: string,
): { customerNameHint?: string; message: string } {
	const customerNameHint = senderName.trim();

	return customerNameHint ? { message, customerNameHint } : { message };
}

export async function handleIncomingGroupMessage(
	message: IncomingMessageLike,
	options: GroupMessageHandlerOptions,
): Promise<GroupMessageResult> {
	if (message.fromMe) {
		return { status: "skipped", reason: "from_me" };
	}

	const chat = await message.getChat();
	if (!chat.isGroup) {
		return { status: "skipped", reason: "not_group" };
	}

	const trimmedMessage = message.body.trim();
	if (!trimmedMessage) {
		options.logger?.warn(
			"[WhatsApp Group Worker] Skipping empty group message payload.",
		);
		return { status: "skipped", reason: "empty_body" };
	}

	const contact = await message.getContact().catch((error: unknown) => {
		options.logger?.warn(
			`[WhatsApp Group Worker] Failed to resolve contact: ${formatError(error)}`,
		);
		return null;
	});

	const senderName = extractSenderName(contact, message.author);
	const groupName = chat.name?.trim() || "Unknown Group";
	const timestamp = formatWhatsAppTimestamp(message.timestamp);

	options.logger?.info(
		`[WhatsApp Group Worker] ${timestamp} | ${groupName} | ${senderName} | ${collapseForLog(trimmedMessage)}`,
	);

	const response = await postOrderRequest(
		buildOrderRequest(trimmedMessage, senderName),
		options,
	);

	if (!response.ok) {
		throw new Error(
			`Order creation failed (${response.status}): ${await readResponseText(response)}`,
		);
	}

	const order = await response
		.json()
		.catch(() => null as { id?: number } | null);

	options.logger?.info(
		`[WhatsApp Group Worker] Created draft order${typeof order?.id === "number" ? ` #${order.id}` : ""} for ${groupName} / ${senderName}.`,
	);

	return {
		status: "processed",
		orderId: typeof order?.id === "number" ? order.id : undefined,
	};
}

export function registerWhatsAppGroupMessageHandler(
	client: Client,
	options: GroupMessageHandlerOptions,
): void {
	const logger = options.logger ?? console;

	client.on("message", (message) => {
		void handleIncomingGroupMessage(message, { ...options, logger }).catch(
			(error) => {
				logger.error(
					`[WhatsApp Group Worker] Failed to process group message: ${formatError(error)}`,
				);
			},
		);
	});
}

async function postOrderRequest(
	payload: { customerNameHint?: string; message: string },
	options: GroupMessageHandlerOptions,
): Promise<Response> {
	const fetchImpl = options.fetchImpl ?? fetch;

	return fetchImpl(options.ordersEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}

async function readResponseText(response: Response): Promise<string> {
	const body = await response.text();
	return body || "Empty response body";
}

function collapseForLog(value: string): string {
	return value.replace(/\s*\n+\s*/g, " / ");
}

function normalizeWhatsAppId(value?: string): string {
	return value ? value.replace(/@.+$/, "") : "";
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
