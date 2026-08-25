CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`subscription_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`plan_handle` text,
	`interval` text,
	`price_amount` integer NOT NULL,
	`price_currency` text NOT NULL,
	`capped_amount_amount` integer,
	`capped_amount_currency` text,
	`shopify_updated_at` integer NOT NULL,
	`shopify_created_at` integer NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscription_events_shop_idx` ON `subscription_events` (`shop`);--> statement-breakpoint
CREATE INDEX `subscription_events_subscription_idx` ON `subscription_events` (`subscription_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_events_dedupe_idx` ON `subscription_events` (`subscription_id`,`shopify_updated_at`);