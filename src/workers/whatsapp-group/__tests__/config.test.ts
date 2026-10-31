import { describe, expect, it } from "vitest";
import { getWhatsAppGroupWorkerConfig } from "../config.ts";

describe("getWhatsAppGroupWorkerConfig", () => {
	it("uses sensible defaults", () => {
		const config = getWhatsAppGroupWorkerConfig({});

		expect(config.apiUrl).toBe("http://localhost:3000");
		expect(config.incomingMessagesEndpoint).toBe(
			"http://localhost:3000/api/incoming-messages",
		);
		expect(config.clientId).toBe("ordex-group-worker");
		expect(config.reconnectDelayMs).toBe(5_000);
		expect(config.qrSmall).toBe(true);
		expect(config.puppeteerHeadless).toBe(true);
		expect(config.includeSelfMessages).toBe(false);
		expect(config.sessionPath).toContain(".wwebjs_auth");
		expect(config.cachePath).toContain(".wwebjs_cache");
	});

	it("supports custom env overrides", () => {
		const config = getWhatsAppGroupWorkerConfig({
			ORDEX_API_URL: "https://ordex.example/internal/",
			WHATSAPP_CACHE_PATH: "tmp/cache",
			WHATSAPP_CHROME_EXECUTABLE_PATH: "/usr/bin/google-chrome",
			WHATSAPP_CLIENT_ID: "ops-bot",
			WHATSAPP_PUPPETEER_HEADLESS: "false",
			WHATSAPP_QR_SMALL: "false",
			WHATSAPP_INCLUDE_SELF_MESSAGES: "true",
			WHATSAPP_RECONNECT_DELAY_MS: "9000",
			WHATSAPP_SESSION_PATH: "tmp/auth",
		});

		expect(config.apiUrl).toBe("https://ordex.example/internal");
		expect(config.incomingMessagesEndpoint).toBe(
			"https://ordex.example/internal/api/incoming-messages",
		);
		expect(config.clientId).toBe("ops-bot");
		expect(config.reconnectDelayMs).toBe(9_000);
		expect(config.puppeteerHeadless).toBe(false);
		expect(config.qrSmall).toBe(false);
		expect(config.includeSelfMessages).toBe(true);
		expect(config.puppeteerExecutablePath).toBe("/usr/bin/google-chrome");
		expect(config.sessionPath).toContain("tmp/auth");
		expect(config.cachePath).toContain("tmp/cache");
	});

	it("throws on invalid env values", () => {
		expect(() =>
			getWhatsAppGroupWorkerConfig({
				ORDEX_API_URL: "not-a-url",
			}),
		).toThrow('Invalid ORDEX_API_URL: "not-a-url"');

		expect(() =>
			getWhatsAppGroupWorkerConfig({
				WHATSAPP_RECONNECT_DELAY_MS: "0",
			}),
		).toThrow('Invalid WHATSAPP_RECONNECT_DELAY_MS: "0"');

		expect(() =>
			getWhatsAppGroupWorkerConfig({
				WHATSAPP_INCLUDE_SELF_MESSAGES: "maybe",
			}),
		).toThrow('Invalid WHATSAPP_INCLUDE_SELF_MESSAGES: "maybe"');
	});
});
