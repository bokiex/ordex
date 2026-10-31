import type { Client, Contact, Message } from "whatsapp-web.js";

export type WorkerLogger = Pick<typeof console, "error" | "info" | "warn">;

type ContactLike = Partial<
	Pick<Contact, "name" | "number" | "pushname" | "shortName">
>;

export type IncomingMessageLike = Pick<
	Message,
	"author" | "body" | "from" | "fromMe" | "to"
> & {
	id?: string | { _serialized?: string };
	timestamp: number;
	getContact(): Promise<ContactLike>;
};

export type GroupMessageHandlerOptions = {
	incomingMessagesEndpoint: string;
	includeSelfMessages?: boolean;
	resolveGroupDisplayName?: (
		groupChatId: string,
	) => Promise<string | undefined>;
	fetchImpl?: typeof fetch;
	logger?: WorkerLogger;
};

export type GroupMessageResult =
	| { status: "processed"; incomingMessageId?: number }
	| {
			status: "skipped";
			reason: "empty_body" | "from_me" | "group_name_unavailable" | "not_group";
	  };

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
	customerNameHint: string,
	senderName: string,
	from?: string,
	timestamp?: number,
	whatsappMessageId?: string,
	groupJid?: string,
): {
	customerNameHint?: string;
	groupJid?: string;
	from?: string;
	message: string;
	senderName?: string;
	timestamp?: string;
	whatsappMessageId?: string;
} {
	return compactObject({
		customerNameHint: customerNameHint.trim(),
		groupJid,
		from: normalizeWhatsAppId(from),
		message,
		senderName: senderName.trim(),
		timestamp: timestamp ? String(timestamp) : undefined,
		whatsappMessageId,
	});
}

export async function handleIncomingGroupMessage(
	message: IncomingMessageLike,
	options: GroupMessageHandlerOptions,
): Promise<GroupMessageResult> {
	if (message.fromMe && !options.includeSelfMessages) {
		return { status: "skipped", reason: "from_me" };
	}

	const groupChatId = getGroupChatId(message);
	if (!groupChatId) {
		return { status: "skipped", reason: "not_group" };
	}

	const trimmedMessage = message.body.trim();
	if (!trimmedMessage) {
		options.logger?.warn(
			"[WhatsApp Group Worker] Skipping empty group message payload.",
		);
		return { status: "skipped", reason: "empty_body" };
	}

	const groupName = await resolveGroupDisplayName(groupChatId, options);
	if (!groupName) {
		return { status: "skipped", reason: "group_name_unavailable" };
	}

	const contact = await message.getContact().catch((error: unknown) => {
		options.logger?.warn(
			`[WhatsApp Group Worker] Failed to resolve contact: ${formatError(error)}`,
		);
		return null;
	});

	const senderName = extractSenderName(contact, message.author);
	const timestamp = formatWhatsAppTimestamp(message.timestamp);

	options.logger?.info(
		`[WhatsApp Group Worker] ${timestamp} | ${groupName} | ${senderName} | ${collapseForLog(trimmedMessage)}`,
	);

	const response = await postIncomingMessageRequest(
		buildOrderRequest(
			trimmedMessage,
			groupName,
			senderName,
			message.author,
			message.timestamp,
			getMessageId(message),
			groupChatId,
		),
		options,
	);

	if (!response.ok) {
		throw new Error(
			`Incoming message save failed (${response.status}): ${await readResponseText(response)}`,
		);
	}

	const result = await response
		.json()
		.catch(() => null as { message?: { id?: number } } | null);

	options.logger?.info(
		`[WhatsApp Group Worker] Stored incoming message${typeof result?.message?.id === "number" ? ` #${result.message.id}` : ""} for ${groupName} / ${senderName}.`,
	);

	return {
		status: "processed",
		incomingMessageId:
			typeof result?.message?.id === "number" ? result.message.id : undefined,
	};
}

export function registerWhatsAppGroupMessageHandler(
	client: Client,
	options: GroupMessageHandlerOptions,
): void {
	const logger = options.logger ?? console;

	const processMessage = (message: IncomingMessageLike) => {
		void handleIncomingGroupMessage(message, { ...options, logger }).catch(
			(error) => {
				logger.error(
					`[WhatsApp Group Worker] Failed to process group message: ${formatError(error)}`,
				);
			},
		);
	};

	client.on("message", processMessage);

	if (options.includeSelfMessages) {
		client.on("message_create", (message) => {
			if (message.fromMe) {
				processMessage(message);
			}
		});
	}
}

async function postIncomingMessageRequest(
	payload: {
		customerNameHint?: string;
		groupJid?: string;
		from?: string;
		message: string;
		senderName?: string;
		timestamp?: string;
		whatsappMessageId?: string;
	},
	options: GroupMessageHandlerOptions,
): Promise<Response> {
	const fetchImpl = options.fetchImpl ?? fetch;

	return fetchImpl(options.incomingMessagesEndpoint, {
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

async function resolveGroupDisplayName(
	groupChatId: string,
	options: GroupMessageHandlerOptions,
): Promise<string | undefined> {
	if (!options.resolveGroupDisplayName) {
		options.logger?.error(
			"[WhatsApp Group Worker] Group display-name resolver is not configured; message was not stored.",
		);
		return undefined;
	}

	try {
		return (
			(await options.resolveGroupDisplayName(groupChatId))?.trim() || undefined
		);
	} catch (error) {
		options.logger?.error(
			`[WhatsApp Group Worker] Failed to resolve group display name; message was not stored: ${formatError(error)}`,
		);
		return undefined;
	}
}

function getGroupChatId(message: IncomingMessageLike): string | undefined {
	const chatId = message.fromMe ? message.to : message.from;
	return chatId?.endsWith("@g.us") ? chatId : undefined;
}

function collapseForLog(value: string): string {
	return value.replace(/\s*\n+\s*/g, " / ");
}

function normalizeWhatsAppId(value?: string): string {
	return value ? value.replace(/@.+$/, "") : "";
}

function getMessageId(message: IncomingMessageLike): string | undefined {
	if (typeof message.id === "string") return message.id;
	return message.id?._serialized;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(
			([, entry]) => entry !== undefined && entry !== "",
		),
	) as T;
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
