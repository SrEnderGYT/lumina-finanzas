CREATE TABLE `transactions_backup_advance_salary_20260926` AS
SELECT *
FROM `transactions`
WHERE `source` = 'gmail'
  AND `parser_id` = 'bcp-v1'
  AND `merchant` = 'la dirección web'
  AND `raw_subject` LIKE 'Constancia de Adelanto de Sueldo%'
  AND `category_source` <> 'manual';
--> statement-breakpoint
UPDATE `gmail_accounts`
SET `last_sync_at` = NULL,
    `history_id` = NULL,
    `updated_at` = unixepoch()
WHERE `user_id` IN (
  SELECT DISTINCT `user_id`
  FROM `transactions_backup_advance_salary_20260926`
);
--> statement-breakpoint
DELETE FROM `transactions`
WHERE `id` IN (SELECT `id` FROM `transactions_backup_advance_salary_20260926`)
  AND `source` = 'gmail'
  AND `parser_id` = 'bcp-v1'
  AND `merchant` = 'la dirección web'
  AND `category_source` <> 'manual';
