import { describe, expect, it } from "vitest";
import { LocalAuth } from "whatsapp-web.js";
import { buildWhatsAppClientOptions } from "../client.ts";
import type { WhatsAppGroupWorkerConfig } from "../config.ts";

const config: WhatsAppGroupWorkerConfig = {
	apiUrl: "http://localhost:3000",
	ordersEndpoint: "http://localhost:3000/api/orders",
	sessionPath: "/tmp/ordex-auth",
	cachePath: "/tmp/ordex-cache",
	clientId: "ordex-test-worker",
	reconnectDelayMs: 5_000,
	puppeteerHeadless: false,
	puppeteerExecutablePath: "/usr/bin/chromium",
	qrSmall: true,
};

describe("buildWhatsAppClientOptions", () => {
	it("uses LocalAuth with the configured session path", () => {
		const options = buildWhatsAppClientOptions(config);

		expect(options.authStrategy).toBeInstanceOf(LocalAuth);
		expect(options.authStrategy).toMatchObject({
			clientId: "ordex-test-worker",
			dataPath: "/tmp/ordex-auth",
		});
	});

	it("configures local cache and puppeteer launch options", () => {
		const options = buildWhatsAppClientOptions(config);

		expect(options.webVersionCache).toEqual({
			type: "local",
			path: "/tmp/ordex-cache",
		});
		expect(options.takeoverOnConflict).toBe(true);
		expect(options.puppeteer).toMatchObject({
			headless: false,
			executablePath: "/usr/bin/chromium",
		});
	});
});
