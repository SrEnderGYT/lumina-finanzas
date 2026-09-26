-- Vuelve a enumerar Gmail únicamente para la cuenta afectada por el falso negativo BCP.
UPDATE `gmail_accounts`
SET `last_sync_at` = NULL,
    `history_id` = NULL,
    `updated_at` = unixepoch()
WHERE `user_id` IN (
  SELECT `user_id`
  FROM `processed_messages`
  WHERE `gmail_message_id` = '1a0db4592733a9cb'
);
--> statement-breakpoint
-- La alerta bancaria se volverá a procesar con las reglas corregidas.
DELETE FROM `processed_messages`
WHERE `gmail_message_id` = '1a0db4592733a9cb';
--> statement-breakpoint
-- El recibo del comercio corresponde al mismo cargo: se conserva como auditoría, no como segundo gasto.
UPDATE `processed_messages`
SET `status` = 'duplicate',
    `classification` = 'transaction',
    `confidence_level` = 'high',
    `reason` = 'Omitido como duplicado: recibo de Uber coincidente con la alerta bancaria BCP (monto, tarjeta y hora).'
WHERE `gmail_message_id` = '1a0db54cacc82589';
