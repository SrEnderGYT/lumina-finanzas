CREATE TABLE `transactions_backup_20260925` AS
SELECT *
FROM `transactions`
WHERE `source` = 'gmail'
  AND `classification` IS NULL
  AND `category_source` <> 'manual';
