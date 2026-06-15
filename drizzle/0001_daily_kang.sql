CREATE TABLE IF NOT EXISTS `incoming_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from` text NOT NULL,
	`sender_name` text NOT NULL,
	`whatsapp_message_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source_order_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `incoming_messages_whatsapp_message_id_unique` ON `incoming_messages` (`whatsapp_message_id`);
