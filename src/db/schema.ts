import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Reference Tables (seeded from Excel) ────────────────────────────────────

/** Product catalogue — sourced from "Item Codes 26.2.26.xlsx" */
export const items = sqliteTable("items", {
	code: text("code").primaryKey(), // e.g. "SFSLALA4060"
	description: text("description").notNull(), // e.g. "WHITE CLAM LALA 40/60 (500G X 20PKT)"
	baseUom: text("base_uom").notNull(), // PKT, CTN, kg, TUBE, etc.
	uomCount: integer("uom_count").default(1),
	itemGroup: text("item_group"), // Beancurd, Seafood, Sauce, Other, etc.
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	stockBalance: real("stock_balance"),
});

/** Customer directory — sourced from "debtor listing.xlsx" */
export const debtors = sqliteTable("debtors", {
	code: text("code").primaryKey(), // e.g. "3000-J003"
	companyName: text("company_name").notNull(), // e.g. "JOS.FK TRADING PTE LTD"
	alias: text("alias"), // 2nd Description — location/shortname
	phone: text("phone"),
	agent: text("agent"), // e.g. "9179", "9900", "136"
	currencyCode: text("currency_code").default("SGD"),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	multiPricing: text("multi_pricing"), // e.g. "Price 1"
});

/** Historical invoice line items — sourced from "INV DETAIL LISTING.xlsx" */
export const invoiceHistory = sqliteTable("invoice_history", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	docNo: text("doc_no").notNull(), // e.g. "INV159935"
	docDate: text("doc_date").notNull(), // ISO date string
	debtorCode: text("debtor_code").notNull(), // no FK — invoice data has codes not in debtor listing
	debtorName: text("debtor_name").notNull(),
	agent: text("agent"),
	itemCode: text("item_code").notNull(), // no FK — invoice data has codes not in item catalogue
	description: text("description").notNull(),
	uom: text("uom").notNull(),
	location: text("location").default("HQ"),
	qty: real("qty").notNull(),
	unitPrice: real("unit_price").notNull(),
	discount: text("discount"),
	lineTotal: real("line_total"), // line subtotal ex tax
	taxCode: text("tax_code").default("SR"),
	taxAmount: real("tax_amount"),
	totalInc: real("total_inc"), // line total inclusive of tax
	desc2: text("desc2"), // customer-specific note
});

// ─── Operational Tables (created by the app) ─────────────────────────────────

/** Orders parsed from WhatsApp messages */
export const orders = sqliteTable("orders", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	debtorCode: text("debtor_code").references(() => debtors.code),
	debtorName: text("debtor_name"), // raw name from WhatsApp before matching
	agent: text("agent"),
	docDate: text("doc_date").notNull(), // ISO date
	rawMessage: text("raw_message").notNull(), // original WhatsApp text
	status: text("status").notNull().default("draft"), // draft | confirmed | exported
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

/** Raw incoming WhatsApp messages awaiting review/order generation */
export const incomingMessages = sqliteTable("incoming_messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	from: text("from").notNull(),
	senderName: text("sender_name").notNull(),
	whatsappMessageId: text("whatsapp_message_id").notNull().unique(),
	timestamp: text("timestamp").notNull(),
	body: text("body").notNull(),
	status: text("status").notNull().default("new"), // new | used
	sourceOrderId: integer("source_order_id").references(() => orders.id),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

/** Line items for each order */
export const orderItems = sqliteTable("order_items", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	orderId: integer("order_id")
		.notNull()
		.references(() => orders.id),
	itemCode: text("item_code").references(() => items.code),
	rawItemName: text("raw_item_name"), // original text from WhatsApp before matching
	description: text("description"),
	uom: text("uom"),
	qty: real("qty").notNull(),
	unitPrice: real("unit_price"),
	lineTotal: real("line_total"),
	matched: integer("matched", { mode: "boolean" }).default(false), // was this fuzzy-matched?
});
