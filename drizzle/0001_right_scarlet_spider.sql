CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank` text NOT NULL,
	`brand` text DEFAULT 'Tarjeta' NOT NULL,
	`last4` text NOT NULL,
	`card_type` text DEFAULT 'Crédito' NOT NULL,
	`alias` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cards_user_bank_last4` ON `cards` (`user_id`,`bank`,`last4`);--> statement-breakpoint
CREATE INDEX `idx_cards_user` ON `cards` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#8a9893' NOT NULL,
	`icon` text DEFAULT 'circle' NOT NULL,
	`kind` text DEFAULT 'expense' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_user_name` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`field` text DEFAULT 'merchant' NOT NULL,
	`operator` text DEFAULT 'contains' NOT NULL,
	`pattern` text NOT NULL,
	`category_id` text NOT NULL,
	`subcategory_id` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rules_user_priority` ON `categorization_rules` (`user_id`,`enabled`,`priority`);--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subcategories_user_category_name` ON `subcategories` (`user_id`,`category_id`,`name`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `source` text DEFAULT 'gmail' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `card_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `category_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `subcategory_id` text;--> statement-breakpoint
CREATE INDEX `idx_transactions_user_card` ON `transactions` (`user_id`,`card_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category_id` ON `transactions` (`user_id`,`category_id`);