CREATE TABLE `gmail_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text,
	`token_expires_at` integer NOT NULL,
	`scope` text NOT NULL,
	`history_id` text,
	`last_sync_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`messages_scanned` integer DEFAULT 0 NOT NULL,
	`transactions_created` integer DEFAULT 0 NOT NULL,
	`duplicates_skipped` integer DEFAULT 0 NOT NULL,
	`parse_failures` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_user_started` ON `sync_runs` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`gmail_message_id` text NOT NULL,
	`gmail_thread_id` text,
	`gmail_internal_date` integer,
	`bank` text NOT NULL,
	`merchant` text NOT NULL,
	`operation_date` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'PEN' NOT NULL,
	`card_type` text,
	`card_last4` text,
	`operation_type` text DEFAULT 'expense' NOT NULL,
	`category` text DEFAULT 'Otros' NOT NULL,
	`category_source` text DEFAULT 'rule' NOT NULL,
	`description` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`raw_subject` text,
	`parser_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_user_message` ON `transactions` (`user_id`,`gmail_message_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`operation_date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_bank` ON `transactions` (`user_id`,`bank`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);