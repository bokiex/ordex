UPDATE `items`
SET `price` = (
	SELECT `unit_price`
	FROM `invoice_history`
	WHERE lower(`invoice_history`.`item_code`) = lower(`items`.`code`)
	ORDER BY `doc_date` DESC, `id` DESC
	LIMIT 1
)
WHERE EXISTS (
	SELECT 1
	FROM `invoice_history`
	WHERE lower(`invoice_history`.`item_code`) = lower(`items`.`code`)
);
