import * as qrcodeTerminal from "qrcode-terminal";
import { createWhatsAppGroupClient } from "./client.ts";
import {
	getWhatsAppGroupWorkerConfig,
	type WhatsAppGroupWorkerConfig,
} from "./config.ts";
import { registerWhatsAppGroupMessageHandler } from "./handlers.ts";

export async function startWhatsAppGroupWorker(
	config: WhatsAppGroupWorkerConfig = getWhatsAppGroupWorkerConfig(),
): Promise<void> {
	const client = createWhatsAppGroupClient(config);
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let isInitializing = false;
	let shuttingDown = false;

	const clearReconnectTimer = () => {
		if (!reconnectTimer) {
			return;
		}

		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	};

	const initializeClient = async (reason: string) => {
		if (shuttingDown || isInitializing) {
			return;
		}

		isInitializing = true;

		try {
			console.info(`[WhatsApp Group Worker] Initializing (${reason})...`);
			await client.initialize();
		} catch (error) {
			console.error(
				`[WhatsApp Group Worker] Client initialization failed: ${formatError(error)}`,
			);
			scheduleReconnect(`${reason}:initialize_failed`);
		} finally {
			isInitializing = false;
		}
	};

	const restartClient = async (reason: string) => {
		if (shuttingDown) {
			return;
		}

		try {
			await client.destroy();
		} catch (error) {
			console.warn(
				`[WhatsApp Group Worker] Failed to cleanly destroy client before reconnect: ${formatError(error)}`,
			);
		}

		await initializeClient(`reconnect:${reason}`);
	};

	const scheduleReconnect = (reason: string) => {
		if (shuttingDown || reconnectTimer) {
			return;
		}

		console.warn(
			`[WhatsApp Group Worker] Scheduling reconnect in ${config.reconnectDelayMs}ms (${reason}).`,
		);

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void restartClient(reason);
		}, config.reconnectDelayMs);
	};

	registerWhatsAppGroupMessageHandler(client, {
		incomingMessagesEndpoint: config.incomingMessagesEndpoint,
		logger: console,
	});

	client.on("qr", (qr) => {
		console.info(
			"[WhatsApp Group Worker] Scan the QR code below with WhatsApp on your phone.",
		);
		qrcodeTerminal.generate(qr, { small: config.qrSmall });
	});

	client.on("authenticated", () => {
		console.info("[WhatsApp Group Worker] Authenticated with WhatsApp Web.");
	});

	client.on("ready", () => {
		clearReconnectTimer();
		console.info(
			`[WhatsApp Group Worker] Ready. Forwarding group messages to ${config.incomingMessagesEndpoint}.`,
		);
	});

	client.on("change_state", (state) => {
		console.info(`[WhatsApp Group Worker] State changed: ${state}`);
	});

	client.on("disconnected", (reason) => {
		console.warn(`[WhatsApp Group Worker] Disconnected: ${reason}`);
		scheduleReconnect(String(reason));
	});

	client.on("auth_failure", (message) => {
		console.error(`[WhatsApp Group Worker] Authentication failure: ${message}`);
		scheduleReconnect("auth_failure");
	});

	const shutdown = async (signal: string) => {
		if (shuttingDown) {
			return;
		}

		shuttingDown = true;
		clearReconnectTimer();
		console.info(`[WhatsApp Group Worker] Shutting down (${signal})...`);

		try {
			await client.destroy();
		} catch (error) {
			console.warn(
				`[WhatsApp Group Worker] Error while shutting down client: ${formatError(error)}`,
			);
		}
	};

	process.once("SIGINT", () => {
		void shutdown("SIGINT").finally(() => process.exit(0));
	});

	process.once("SIGTERM", () => {
		void shutdown("SIGTERM").finally(() => process.exit(0));
	});

	await initializeClient("startup");
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
	void startWhatsAppGroupWorker().catch((error) => {
		console.error(
			`[WhatsApp Group Worker] Fatal startup error: ${formatError(error)}`,
		);
		process.exitCode = 1;
	});
}
