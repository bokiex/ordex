import { Client, type ClientOptions, LocalAuth } from "whatsapp-web.js";
import {
	getWhatsAppGroupWorkerConfig,
	type WhatsAppGroupWorkerConfig,
} from "./config.ts";

export function buildWhatsAppClientOptions(
	config: WhatsAppGroupWorkerConfig,
): ClientOptions {
	return {
		authStrategy: new LocalAuth({
			clientId: config.clientId,
			dataPath: config.sessionPath,
		}),
		webVersionCache: {
			type: "local",
			path: config.cachePath,
		},
		takeoverOnConflict: true,
		puppeteer: compactObject({
			headless: config.puppeteerHeadless,
			executablePath: config.puppeteerExecutablePath,
		}),
	};
}

export function createWhatsAppGroupClient(
	config: WhatsAppGroupWorkerConfig = getWhatsAppGroupWorkerConfig(),
): Client {
	return new Client(buildWhatsAppClientOptions(config));
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as T;
}
