DELETE FROM `transactions`
WHERE `source` = 'gmail'
  AND `classification` IS NULL
  AND `category_source` <> 'manual';
--> statement-breakpoint
UPDATE `gmail_accounts`
SET `last_sync_at` = NULL,
    `history_id` = NULL,
    `updated_at` = unixepoch()
WHERE `user_id` IN (
  SELECT DISTINCT `user_id`
  FROM `transactions_backup_20260925`
)
  AND (`last_sync_at` IS NOT NULL OR `history_id` IS NOT NULL);
