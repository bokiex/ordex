import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "ordex.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS incoming_messages (
		id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		"from" text NOT NULL,
		sender_name text NOT NULL,
		whatsapp_message_id text NOT NULL UNIQUE,
		timestamp text NOT NULL,
		body text NOT NULL,
		status text NOT NULL DEFAULT 'new',
		source_order_id integer,
		created_at text NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (source_order_id) REFERENCES orders(id) ON UPDATE no action ON DELETE no action
	)
`);

export const db = drizzle(sqlite, { schema });
