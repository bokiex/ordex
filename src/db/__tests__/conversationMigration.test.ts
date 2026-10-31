import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { expect, it } from "vitest";

it("preserves legacy messages and their order links when adding conversation identity", () => {
	const db = new Database(":memory:");
	try {
		db.pragma("foreign_keys = ON");
		for (const migration of [
			"0000_right_revanche.sql",
			"0001_daily_kang.sql",
			"0002_lovely_fenris.sql",
			"0003_skinny_microchip.sql",
			"0004_backfill_item_prices.sql",
		])
			db.exec(readFileSync(resolve("drizzle", migration), "utf8"));
		db.exec(`
			INSERT INTO orders (id, doc_date, raw_message, status, created_at) VALUES (1, '2026-03-01', 'test', 'draft', '2026-03-01');
			INSERT INTO incoming_messages (id, "from", sender_name, customer_name_hint, whatsapp_message_id, timestamp, body, status, source_order_id, created_at)
			VALUES (1, 'sender', 'Sender', 'Customer', 'wamid.1', '100', 'test', 'used', 1, '2026-03-01');
		`);
		db.exec(
			readFileSync(resolve("drizzle", "0005_clammy_elektra.sql"), "utf8"),
		);
		expect(
			db
				.prepare(
					"SELECT id, customer_name_hint, status, source_order_id, conversation_key FROM incoming_messages",
				)
				.get(),
		).toEqual({
			id: 1,
			customer_name_hint: "Customer",
			status: "used",
			source_order_id: 1,
			conversation_key: null,
		});
		expect(db.pragma("foreign_key_check")).toEqual([]);
	} finally {
		db.close();
	}
});
