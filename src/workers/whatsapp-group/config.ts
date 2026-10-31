import { resolve } from "node:path";

const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_SESSION_PATH = ".wwebjs_auth";
const DEFAULT_CACHE_PATH = ".wwebjs_cache";
const DEFAULT_CLIENT_ID = "ordex-group-worker";
const DEFAULT_RECONNECT_DELAY_MS = 5_000;

export type WhatsAppGroupWorkerConfig = {
	apiUrl: string;
	incomingMessagesEndpoint: string;
	sessionPath: string;
	cachePath: string;
	clientId: string;
	reconnectDelayMs: number;
	puppeteerHeadless: boolean;
	puppeteerExecutablePath?: string;
	qrSmall: boolean;
	includeSelfMessages: boolean;
};

export function getWhatsAppGroupWorkerConfig(
	env: NodeJS.ProcessEnv = process.env,
): WhatsAppGroupWorkerConfig {
	const apiUrl = parseUrl(
		env.ORDEX_API_URL ?? DEFAULT_API_URL,
		"ORDEX_API_URL",
	);

	return {
		apiUrl: stripTrailingSlash(apiUrl.toString()),
		incomingMessagesEndpoint: new URL(
			"api/incoming-messages",
			ensureTrailingSlash(apiUrl),
		).toString(),
		sessionPath: resolve(env.WHATSAPP_SESSION_PATH ?? DEFAULT_SESSION_PATH),
		cachePath: resolve(env.WHATSAPP_CACHE_PATH ?? DEFAULT_CACHE_PATH),
		clientId: env.WHATSAPP_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID,
		reconnectDelayMs: readPositiveNumber(
			env.WHATSAPP_RECONNECT_DELAY_MS,
			DEFAULT_RECONNECT_DELAY_MS,
			"WHATSAPP_RECONNECT_DELAY_MS",
		),
		puppeteerHeadless: readBoolean(
			env.WHATSAPP_PUPPETEER_HEADLESS,
			true,
			"WHATSAPP_PUPPETEER_HEADLESS",
		),
		puppeteerExecutablePath:
			env.WHATSAPP_CHROME_EXECUTABLE_PATH?.trim() || undefined,
		qrSmall: readBoolean(env.WHATSAPP_QR_SMALL, true, "WHATSAPP_QR_SMALL"),
		includeSelfMessages: readBoolean(
			env.WHATSAPP_INCLUDE_SELF_MESSAGES,
			false,
			"WHATSAPP_INCLUDE_SELF_MESSAGES",
		),
	};
}

function parseUrl(rawValue: string, envName: string): URL {
	try {
		return new URL(rawValue);
	} catch {
		throw new Error(`Invalid ${envName}: "${rawValue}"`);
	}
}

function ensureTrailingSlash(url: URL): URL {
	const value = new URL(url.toString());
	if (!value.pathname.endsWith("/")) {
		value.pathname = `${value.pathname}/`;
	}

	return value;
}

function stripTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readPositiveNumber(
	value: string | undefined,
	defaultValue: number,
	envName: string,
): number {
	if (!value) {
		return defaultValue;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${envName}: "${value}"`);
	}

	return parsed;
}

function readBoolean(
	value: string | undefined,
	defaultValue: boolean,
	envName: string,
): boolean {
	if (!value) {
		return defaultValue;
	}

	const normalized = value.trim().toLowerCase();

	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}

	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}

	throw new Error(`Invalid ${envName}: "${value}"`);
}
