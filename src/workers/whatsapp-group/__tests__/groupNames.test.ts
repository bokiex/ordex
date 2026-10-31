import { describe, expect, it, vi } from "vitest";
import type { Client } from "whatsapp-web.js";
import { createGroupDisplayNameResolver } from "../groupNames.ts";

describe("createGroupDisplayNameResolver", () => {
	it("caches display names loaded from WhatsApp Web", async () => {
		const evaluate = vi.fn().mockResolvedValue([
			{ id: "120363000000000000@g.us", name: "Orders Group" },
			{ id: "120363000000000001@g.us", name: "Backup Orders" },
		]);
		const resolver = createGroupDisplayNameResolver({
			pupPage: { evaluate },
		} as unknown as Pick<Client, "pupPage">);

		expect(await resolver.resolve("120363000000000000@g.us")).toBe(
			"Orders Group",
		);
		expect(await resolver.resolve("120363000000000001@g.us")).toBe(
			"Backup Orders",
		);
		expect(evaluate).toHaveBeenCalledOnce();
	});

	it("shares a single refresh while concurrent lookups populate the cache", async () => {
		let completeRefresh:
			| ((value: Array<{ id: string; name: string }>) => void)
			| undefined;
		const evaluate = vi.fn(
			() =>
				new Promise<Array<{ id: string; name: string }>>((resolve) => {
					completeRefresh = resolve;
				}),
		);
		const resolver = createGroupDisplayNameResolver({
			pupPage: { evaluate },
		} as unknown as Pick<Client, "pupPage">);

		const firstLookup = resolver.resolve("120363000000000000@g.us");
		const secondLookup = resolver.resolve("120363000000000001@g.us");
		completeRefresh?.([
			{ id: "120363000000000000@g.us", name: "Orders Group" },
			{ id: "120363000000000001@g.us", name: "Backup Orders" },
		]);

		await expect(firstLookup).resolves.toBe("Orders Group");
		await expect(secondLookup).resolves.toBe("Backup Orders");
		expect(evaluate).toHaveBeenCalledOnce();
	});
});
