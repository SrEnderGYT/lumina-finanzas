-- Respaldo permanente de los movimientos cuyo comercio fue tomado por error del pie legal de BCP.
CREATE TABLE `transactions_backup_parser_noise_20260926` AS
SELECT *
FROM `transactions`
WHERE `source` = 'gmail'
  AND `parser_id` = 'bcp-v1'
  AND `merchant` = 'sorteos o promociones'
  AND `category_source` <> 'manual';
--> statement-breakpoint
-- Solo las cuentas propietarias de esos movimientos vuelven a enumerar Gmail.
UPDATE `gmail_accounts`
SET `last_sync_at` = NULL,
    `history_id` = NULL,
    `updated_at` = unixepoch()
WHERE `user_id` IN (
  SELECT DISTINCT `user_id`
  FROM `transactions_backup_parser_noise_20260926`
);
--> statement-breakpoint
-- Eliminación exacta por ID respaldado; no alcanza movimientos manuales ni categorías corregidas manualmente.
DELETE FROM `transactions`
WHERE `id` IN (SELECT `id` FROM `transactions_backup_parser_noise_20260926`)
  AND `source` = 'gmail'
  AND `parser_id` = 'bcp-v1'
  AND `merchant` = 'sorteos o promociones'
  AND `category_source` <> 'manual';
