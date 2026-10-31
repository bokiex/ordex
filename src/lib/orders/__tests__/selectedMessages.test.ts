import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { IncomingMessage } from "@/lib/db/types";
import {
	groupConversationKey,
	groupIncomingMessages,
	metaConversationKey,
} from "@/lib/incomingMessages/conversations";
import { createMockTextMessage } from "@/lib/whatsapp/mock";

const mocks = vi.hoisted(() => ({ parse: vi.fn(), failMatch: false }));
vi.mock("@/lib/parser/index", () => ({ parseOrderMessage: mocks.parse }));
vi.mock("@/lib/matcher/index", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/matcher/index")>();
	return {
		...actual,
		matchItem: (...args: Parameters<typeof actual.matchItem>) => {
			if (mocks.failMatch) throw new Error("matching failed");
			return actual.matchItem(...args);
		},
	};
});

let sqlite: Database.Database;
let directory: string;
let originalDatabaseUrl: string | undefined;
let db: typeof import("@/db/index").db;
let generate: typeof import("../createOrderFromSelectedMessages").createOrderFromSelectedMessages;
let createDirect: typeof import("../createOrderFromMessage").createOrderFromMessage;
let deleteOrder: typeof import("@/lib/db/orders").deleteOrder;
let events: typeof import("@/lib/events/incomingMessages");

const parsed = {
	customerName: "Parsed Customer",
	deliveryDate: "2026-03-04",
	notes: null,
	items: [
		{ rawText: "fish x 2", itemName: "Fish", qty: 2, uom: "PKT" },
		{ rawText: "unknown x 3", itemName: "Unknown", qty: 3, uom: "PKT" },
	],
};

beforeAll(async () => {
	directory = mkdtempSync(join(tmpdir(), "ordex-generation-"));
	const path = join(directory, "test.db");
	sqlite = new Database(path);
	for (const migration of [
		"0000_right_revanche.sql",
		"0001_daily_kang.sql",
		"0002_lovely_fenris.sql",
		"0003_skinny_microchip.sql",
		"0004_backfill_item_prices.sql",
		"0005_clammy_elektra.sql",
	]) {
		sqlite.exec(readFileSync(resolve("drizzle", migration), "utf8"));
	}
	originalDatabaseUrl = process.env.DATABASE_URL;
	process.env.DATABASE_URL = path;
	({ db } = await import("@/db/index"));
	({ createOrderFromSelectedMessages: generate } = await import(
		"../createOrderFromSelectedMessages"
	));
	({ createOrderFromMessage: createDirect } = await import(
		"../createOrderFromMessage"
	));
	({ deleteOrder } = await import("@/lib/db/orders"));
	events = await import("@/lib/events/incomingMessages");
});

beforeEach(() => {
	sqlite.exec(`
		DROP TRIGGER IF EXISTS fail_message_update;
		DELETE FROM incoming_messages;
		DELETE FROM order_items;
		DELETE FROM orders;
		DELETE FROM items;
		DELETE FROM debtors;
		INSERT INTO items (code, description, base_uom, is_active, price) VALUES ('FISH', 'Fish', 'PKT', 1, 4);
	`);
	mocks.parse.mockReset().mockResolvedValue(parsed);
	mocks.failMatch = false;
});

afterAll(() => {
	db.$client.close();
	sqlite.close();
	if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
	else process.env.DATABASE_URL = originalDatabaseUrl;
	rmSync(directory, { recursive: true, force: true });
});

function addMessage(
	body: string,
	timestamp: string,
	group = "Customer",
	conversationKey: string | null = groupConversationKey(`${group}@g.us`),
) {
	const result = sqlite
		.prepare(`INSERT INTO incoming_messages
		("from", sender_name, customer_name_hint, conversation_key, whatsapp_message_id, timestamp, body, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
		.run(
			"sender",
			"Sender",
			group,
			conversationKey,
			`id-${Math.random()}`,
			timestamp,
			body,
			"2026-03-01",
		);
	return Number(result.lastInsertRowid);
}

function rows(table: string) {
	return sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
}

function observeEvents() {
	const incoming = vi.fn();
	const orders = vi.fn();
	const unsubscribeIncoming =
		events.subscribeToIncomingMessagesChanged(incoming);
	const unsubscribeOrders = events.subscribeToOrdersChanged(orders);
	return {
		incoming,
		orders,
		close: () => {
			unsubscribeIncoming();
			unsubscribeOrders();
		},
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("conversation identity across intake and selection", () => {
	it("keeps renamed groups together, separates same-name sources, and isolates legacy messages", async () => {
		type Handler = (context: { request: Request }) => Promise<Response>;
		type RouteOptions = {
			server: { handlers: { GET: Handler; POST: Handler } };
		};
		const incoming = (
			(await import("@/routes/api/incoming-messages")).Route
				.options as unknown as RouteOptions
		).server.handlers;
		const webhook = (
			(await import("@/routes/api/webhook.whatsapp")).Route
				.options as unknown as RouteOptions
		).server.handlers;
		const post = (body: object) => ({
			request: new Request("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}),
		});
		const first = await incoming.POST(
			post({
				message: "old",
				groupJid: "123@g.us",
				customerNameHint: "Old name",
				timestamp: "100",
				whatsappMessageId: "group-1",
			}),
		);
		const renamed = await incoming.POST(
			post({
				message: "new",
				groupJid: "123@g.us",
				customerNameHint: "New name",
				timestamp: "200",
				whatsappMessageId: "group-2",
			}),
		);
		const other = await incoming.POST(
			post({
				message: "other",
				groupJid: "456@g.us",
				customerNameHint: "New name",
				timestamp: "300",
				whatsappMessageId: "group-3",
			}),
		);
		const legacy = await incoming.POST(
			post({
				message: "legacy",
				customerNameHint: "New name",
				timestamp: "400",
				whatsappMessageId: "legacy-1",
			}),
		);
		const legacy2 = await incoming.POST(
			post({
				message: "legacy 2",
				customerNameHint: "New name",
				timestamp: "401",
				whatsappMessageId: "legacy-2",
			}),
		);
		expect([
			first.status,
			renamed.status,
			other.status,
			legacy.status,
			legacy2.status,
		]).toEqual([201, 201, 201, 201, 201]);
		const duplicate = await incoming.POST(
			post({
				message: "old",
				groupJid: "123@g.us",
				customerNameHint: "Old name",
				whatsappMessageId: "group-1",
			}),
		);
		expect(await duplicate.json()).toMatchObject({ duplicate: true });
		expect(
			(await incoming.POST(post({ message: "bad", groupJid: "123@c.us" })))
				.status,
		).toBe(400);

		const meta = createMockTextMessage({
			from: "6591111111",
			name: "New name",
			body: "meta",
			timestamp: "500",
		});
		expect((await webhook.POST(post(meta))).status).toBe(200);
		expect((await webhook.POST(post(meta))).status).toBe(200);
		const metaOtherPhone = createMockTextMessage({
			from: "6591111111",
			name: "New name",
			body: "meta other",
			timestamp: "501",
		});
		metaOtherPhone.entry[0].changes[0].value.metadata.phone_number_id =
			"another-phone";
		expect((await webhook.POST(post(metaOtherPhone))).status).toBe(200);
		const missingMeta = createMockTextMessage({
			from: "6591111111",
			name: "New name",
			body: "meta missing",
			timestamp: "502",
		});
		missingMeta.entry[0].changes[0].value.metadata.phone_number_id = "";
		expect((await webhook.POST(post(missingMeta))).status).toBe(200);

		const response = await incoming.GET({
			request: new Request("http://localhost?status=new"),
		});
		const messages: IncomingMessage[] = await response.json();
		expect(messages).toHaveLength(8);
		const groups = groupIncomingMessages(messages);
		expect(groups).toHaveLength(7);
		const groupA = groups.find(
			(group) => group.conversationKey === groupConversationKey("123@g.us"),
		);
		expect(groupA).toMatchObject({
			customerName: "New name",
			messages: expect.arrayContaining([
				expect.objectContaining({ body: "old" }),
				expect.objectContaining({ body: "new" }),
			]),
		});
		expect(groupA?.messages).toHaveLength(2);
		expect(
			groups.filter((group) => group.conversationKey === null),
		).toHaveLength(3);
		expect(
			groups.some(
				(group) =>
					group.conversationKey ===
					metaConversationKey(
						meta.entry[0].id,
						meta.entry[0].changes[0].value.metadata.phone_number_id,
						"6591111111",
					),
			),
		).toBe(true);
		expect(
			groups.some(
				(group) =>
					group.conversationKey ===
					metaConversationKey(meta.entry[0].id, "another-phone", "6591111111"),
			),
		).toBe(true);

		if (!groupA) throw new Error("Group A not found");
		const ids = groupA.messages.map((message) => message.id);
		const result = await generate(ids);
		expect(result).toMatchObject({
			success: true,
			order: { debtorName: "New name", rawMessage: "old\nnew" },
		});
		if (!result.success) throw new Error(result.error);
		expect(deleteOrder(result.order.id).releasedMessageIds.sort()).toEqual(
			ids.sort(),
		);
		const findId = (body: string) => {
			const message = messages.find((entry) => entry.body === body);
			if (!message) throw new Error(`Missing ${body}`);
			return message.id;
		};
		for (const otherBody of [
			"other",
			"legacy",
			"meta",
			"meta other",
			"meta missing",
		]) {
			expect(await generate([findId("new"), findId(otherBody)])).toMatchObject({
				success: false,
				stage: "group",
			});
		}
		expect(
			(
				await incoming.POST(
					post({ messageIds: [findId("new"), findId("other")] }),
				)
			).status,
		).toBe(400);
		expect(
			await generate([findId("legacy"), findId("legacy 2")]),
		).toMatchObject({ success: false, stage: "group" });
		expect(await generate([findId("old")])).toMatchObject({
			success: true,
			order: { debtorName: "Old name" },
		});
		expect(await generate([findId("legacy")])).toMatchObject({ success: true });
	});

	it("scopes fallback fingerprints to the worker group while preserving deduplication", async () => {
		type Handler = (context: { request: Request }) => Promise<Response>;
		const incoming = (
			(await import("@/routes/api/incoming-messages")).Route
				.options as unknown as { server: { handlers: { POST: Handler } } }
		).server.handlers.POST;
		const post = (groupJid: string) =>
			incoming({
				request: new Request("http://localhost", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						groupJid,
						from: "sender",
						message: "same",
						timestamp: "100",
					}),
				}),
			});
		expect((await post("1@g.us")).status).toBe(201);
		expect((await post("1@g.us")).status).toBe(200);
		expect((await post("2@g.us")).status).toBe(201);
	});
});

describe("selected-message draft generation", () => {
	it("commits ordered messages, matching and links before publishing, and restores messages on deletion", async () => {
		const later = addMessage("second", "200");
		const earlier = addMessage("first", "100");
		const observed = observeEvents();
		const onEvent = vi.fn(() =>
			expect(rows("incoming_messages")).toEqual([
				expect.objectContaining({ status: "used" }),
				expect.objectContaining({ status: "used" }),
			]),
		);
		const unsubscribe = events.subscribeToOrdersChanged(onEvent);
		try {
			const result = await generate([later, earlier, later]);
			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(mocks.parse).toHaveBeenCalledWith(
				"first\nsecond",
				expect.any(String),
			);
			expect(result.order).toMatchObject({
				debtorName: "Customer",
				rawMessage: "first\nsecond",
				status: "draft",
				docDate: "2026-03-04",
			});
			expect(result.order.items).toHaveLength(2);
			expect(result.order.items[0]).toMatchObject({
				itemCode: "FISH",
				qty: 2,
				unitPrice: 4,
				lineTotal: 8,
				matched: true,
			});
			expect(result.order.items[1]).toMatchObject({
				itemCode: null,
				matched: false,
			});
			expect(rows("incoming_messages")).toEqual([
				expect.objectContaining({
					status: "used",
					source_order_id: result.order.id,
				}),
				expect.objectContaining({
					status: "used",
					source_order_id: result.order.id,
				}),
			]);
			expect(observed.incoming).toHaveBeenCalledOnce();
			expect(observed.incoming).toHaveBeenCalledWith({
				action: "used",
				ids: [later, earlier],
			});
			expect(observed.orders).toHaveBeenCalledWith({
				action: "created",
				orderId: result.order.id,
			});
			expect(onEvent).toHaveBeenCalledOnce();
			expect(deleteOrder(result.order.id).releasedMessageIds.sort()).toEqual(
				[later, earlier].sort(),
			);
			expect(rows("incoming_messages")).toEqual([
				expect.objectContaining({ status: "new", source_order_id: null }),
				expect.objectContaining({ status: "new", source_order_id: null }),
			]);
		} finally {
			unsubscribe();
			observed.close();
		}
	});

	it("rejects unavailable or mixed-group selections before parsing", async () => {
		const first = addMessage("first", "1");
		const second = addMessage("second", "2", "Other");
		expect(await generate([first, 999999])).toMatchObject({
			success: false,
			stage: "selection",
		});
		expect(await generate([first, second])).toMatchObject({
			success: false,
			stage: "group",
		});
		expect(mocks.parse).not.toHaveBeenCalled();
	});

	it("commits only one of two overlapping requests", async () => {
		const id = addMessage("fish", "1");
		const pending = deferred<typeof parsed>();
		mocks.parse.mockReturnValue(pending.promise);
		const observed = observeEvents();
		try {
			const first = generate([id]);
			const second = generate([id]);
			pending.resolve(parsed);
			const results = await Promise.all([first, second]);
			expect(results.filter((result) => result.success)).toHaveLength(1);
			expect(results.filter((result) => !result.success)).toEqual([
				expect.objectContaining({ stage: "selection" }),
			]);
			expect(rows("orders")).toHaveLength(1);
			expect(rows("order_items")).toHaveLength(2);
			expect(observed.incoming).toHaveBeenCalledOnce();
			expect(observed.orders).toHaveBeenCalledOnce();
		} finally {
			observed.close();
		}
	});

	it("leaves non-overlapping messages available when overlapping selections race", async () => {
		const shared = addMessage("shared", "1");
		const firstOnly = addMessage("first", "2");
		const secondOnly = addMessage("second", "3");
		const pending = deferred<typeof parsed>();
		mocks.parse.mockReturnValue(pending.promise);
		const first = generate([shared, firstOnly]);
		const second = generate([shared, secondOnly]);
		pending.resolve(parsed);
		const [winner, loser] = await Promise.all([first, second]);
		expect(winner.success).toBe(true);
		expect(loser).toMatchObject({ success: false, stage: "selection" });
		expect(rows("orders")).toHaveLength(1);
		expect(rows("incoming_messages")).toEqual([
			expect.objectContaining({ id: shared, status: "used" }),
			expect.objectContaining({ id: firstOnly, status: "used" }),
			expect.objectContaining({
				id: secondOnly,
				status: "new",
				source_order_id: null,
			}),
		]);
	});

	it.each([
		"deleted",
		"used",
	])("rejects a message %s while parsing", async (change) => {
		const id = addMessage("fish", "1");
		const pending = deferred<typeof parsed>();
		mocks.parse.mockReturnValue(pending.promise);
		const observed = observeEvents();
		try {
			const request = generate([id]);
			if (change === "deleted")
				sqlite.prepare("DELETE FROM incoming_messages WHERE id = ?").run(id);
			else
				sqlite
					.prepare("UPDATE incoming_messages SET status = 'used' WHERE id = ?")
					.run(id);
			pending.resolve(parsed);
			expect(await request).toMatchObject({
				success: false,
				stage: "selection",
			});
			expect(rows("orders")).toHaveLength(0);
			expect(rows("order_items")).toHaveLength(0);
			expect(observed.incoming).not.toHaveBeenCalled();
			expect(observed.orders).not.toHaveBeenCalled();
		} finally {
			observed.close();
		}
	});

	it.each([
		"parse",
		"matching",
		"write",
	])("leaves no partial draft on %s failure", async (failure) => {
		const id = addMessage("fish", "1");
		if (failure === "parse")
			mocks.parse.mockRejectedValue(new Error("parse failed"));
		if (failure === "matching") mocks.failMatch = true;
		if (failure === "write")
			sqlite.exec(
				`CREATE TRIGGER fail_message_update BEFORE UPDATE ON incoming_messages BEGIN SELECT RAISE(ABORT, 'write failed'); END`,
			);
		const observed = observeEvents();
		try {
			expect(await generate([id])).toMatchObject({
				success: false,
				stage: failure === "parse" ? "parse" : "create",
			});
			expect(rows("orders")).toHaveLength(0);
			expect(rows("order_items")).toHaveLength(0);
			expect(rows("incoming_messages")).toEqual([
				expect.objectContaining({ status: "new", source_order_id: null }),
			]);
			expect(observed.incoming).not.toHaveBeenCalled();
			expect(observed.orders).not.toHaveBeenCalled();
		} finally {
			observed.close();
		}
	});

	it("maps concurrent generation and direct-message outcomes to HTTP responses", async () => {
		const incomingRoute = (await import("@/routes/api/incoming-messages"))
			.Route;
		const ordersRoute = (await import("@/routes/api/orders")).Route;
		type PostHandler = (context: { request: Request }) => Promise<Response>;
		const incomingPost = (
			incomingRoute.options as unknown as {
				server: { handlers: { POST: PostHandler } };
			}
		).server.handlers.POST;
		const orderPost = (
			ordersRoute.options as unknown as {
				server: { handlers: { POST: PostHandler } };
			}
		).server.handlers.POST;
		const request = (body: object) => ({
			request: new Request("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}),
		});
		const id = addMessage("fish", "1");
		const pending = deferred<typeof parsed>();
		mocks.parse.mockReturnValue(pending.promise);
		const first = incomingPost(request({ messageIds: [id] }));
		const second = incomingPost(request({ messageIds: [id] }));
		// Both handlers await request.json() before they start parsing.
		await vi.waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(2));
		pending.resolve(parsed);
		const responses = await Promise.all([first, second]);
		expect(responses.map((response) => response.status).sort()).toEqual([
			201, 409,
		]);

		mocks.parse.mockResolvedValue(parsed);
		const direct = await orderPost(
			request({ message: "fish", customerNameHint: "Customer" }),
		);
		expect(direct.status).toBe(201);
		expect(await direct.json()).toMatchObject({
			debtorName: "Customer",
			status: "draft",
		});
		mocks.parse.mockRejectedValue(new Error("offline"));
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const failed = await orderPost(request({ message: "fish" }));
			expect(failed.status).toBe(502);
			expect(await failed.json()).toEqual({
				error: "Failed to parse order: offline",
			});
		} finally {
			log.mockRestore();
		}
	});

	it("preserves direct-message creation and parse errors", async () => {
		const result = await createDirect({
			message: "fish x 2",
			date: "2026-03-01",
			customerNameHint: "Customer",
		});
		expect(result).toMatchObject({
			success: true,
			order: {
				debtorName: "Customer",
				rawMessage: "fish x 2",
				status: "draft",
			},
		});
		expect(rows("order_items")).toHaveLength(2);
		mocks.parse.mockRejectedValue(new Error("offline"));
		expect(await createDirect({ message: "fish" })).toEqual({
			success: false,
			stage: "parse",
			error: "offline",
		});
	});
});
