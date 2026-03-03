CREATE TABLE `debtors` (
	`code` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`alias` text,
	`phone` text,
	`agent` text,
	`currency_code` text DEFAULT 'SGD',
	`is_active` integer DEFAULT true,
	`multi_pricing` text
);
--> statement-breakpoint
CREATE TABLE `invoice_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_no` text NOT NULL,
	`doc_date` text NOT NULL,
	`debtor_code` text NOT NULL,
	`debtor_name` text NOT NULL,
	`agent` text,
	`item_code` text NOT NULL,
	`description` text NOT NULL,
	`uom` text NOT NULL,
	`location` text DEFAULT 'HQ',
	`qty` real NOT NULL,
	`unit_price` real NOT NULL,
	`discount` text,
	`line_total` real,
	`tax_code` text DEFAULT 'SR',
	`tax_amount` real,
	`total_inc` real,
	`desc2` text
);
--> statement-breakpoint
CREATE TABLE `items` (
	`code` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`base_uom` text NOT NULL,
	`uom_count` integer DEFAULT 1,
	`item_group` text,
	`is_active` integer DEFAULT true,
	`stock_balance` real
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`item_code` text,
	`raw_item_name` text,
	`description` text,
	`uom` text,
	`qty` real NOT NULL,
	`unit_price` real,
	`line_total` real,
	`matched` integer DEFAULT false,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_code`) REFERENCES `items`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`debtor_code` text,
	`debtor_name` text,
	`agent` text,
	`doc_date` text NOT NULL,
	`raw_message` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`debtor_code`) REFERENCES `debtors`(`code`) ON UPDATE no action ON DELETE no action
);
