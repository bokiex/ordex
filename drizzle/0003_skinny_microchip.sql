ALTER TABLE `items` RENAME COLUMN "stock_balance" TO "price";
--> statement-breakpoint
UPDATE `items`
SET `price` = (
	SELECT `unit_price`
	FROM `invoice_history`
	WHERE lower(`invoice_history`.`item_code`) = lower(`items`.`code`)
	ORDER BY `doc_date` DESC, `id` DESC
	LIMIT 1
);
