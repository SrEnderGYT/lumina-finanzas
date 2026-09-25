ALTER TABLE `processed_messages` ADD `classification` text;--> statement-breakpoint
ALTER TABLE `processed_messages` ADD `confidence_level` text;--> statement-breakpoint
ALTER TABLE `processed_messages` ADD `reason` text;--> statement-breakpoint
ALTER TABLE `processed_messages` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `classification` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `confidence_level` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `decision_reason` text;