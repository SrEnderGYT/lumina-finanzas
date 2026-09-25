CREATE TABLE `processed_messages` (
	`user_id` text NOT NULL,
	`gmail_message_id` text NOT NULL,
	`status` text DEFAULT 'ignored' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `gmail_message_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
UPDATE `sync_runs` SET `status` = 'failed', `error_message` = 'Cerrada por migración', `finished_at` = unixepoch() WHERE `status` = 'running';
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sync_runs_one_running` ON `sync_runs` (`user_id`) WHERE status = 'running';