CREATE TABLE `shop_granted_scopes` (
	`shop` text NOT NULL,
	`scope` text NOT NULL,
	`granted_at` integer NOT NULL,
	PRIMARY KEY(`shop`, `scope`)
);
--> statement-breakpoint
CREATE INDEX `shop_granted_scopes_scope_idx` ON `shop_granted_scopes` (`scope`);--> statement-breakpoint
CREATE TABLE `shop_scope_change_items` (
	`scope_change_id` text NOT NULL,
	`scope` text NOT NULL,
	`change` text NOT NULL,
	PRIMARY KEY(`scope_change_id`, `scope`),
	FOREIGN KEY (`scope_change_id`) REFERENCES `shop_scope_changes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shop_scope_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`source` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shop_scope_changes_shop_occurred_idx` ON `shop_scope_changes` (`shop`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `shop_subscription_items` (
	`shop` text NOT NULL,
	`subscription_id` text NOT NULL,
	`position` integer NOT NULL,
	`item_type` text NOT NULL,
	`price_amount` integer,
	`price_currency` text,
	`capped_amount_amount` integer,
	`capped_amount_currency` text,
	PRIMARY KEY(`shop`, `subscription_id`, `position`),
	FOREIGN KEY (`shop`,`subscription_id`) REFERENCES `shop_subscriptions`(`shop`,`subscription_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shop_subscriptions` (
	`shop` text NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`plan_handle` text,
	`billing_interval` text,
	`trial_ends_at` integer,
	`current_period_ends_at` integer,
	`cancellation_effective_at` integer,
	`applied_occurred_at` integer NOT NULL,
	`applied_external_id` text NOT NULL,
	PRIMARY KEY(`shop`, `subscription_id`)
);
--> statement-breakpoint
CREATE INDEX `shop_subscriptions_shop_status_idx` ON `shop_subscriptions` (`shop`,`status`);--> statement-breakpoint
CREATE TABLE `shopify_events` (
	`source` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`shop` text NOT NULL,
	`shopify_shop_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`synchronized_at` integer NOT NULL,
	PRIMARY KEY(`source`, `event_id`)
);
--> statement-breakpoint
CREATE INDEX `shopify_events_shop_occurred_idx` ON `shopify_events` (`shop`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `shopify_relationship_events` (
	`event_source` text NOT NULL,
	`event_id` text NOT NULL,
	`reason` text,
	`reason_description` text,
	PRIMARY KEY(`event_source`, `event_id`),
	FOREIGN KEY (`event_source`,`event_id`) REFERENCES `shopify_events`(`source`,`event_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shopify_subscription_events` (
	`event_source` text NOT NULL,
	`event_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`plan_handle` text,
	`billing_interval` text,
	`trial_ends_at` integer,
	`current_period_ends_at` integer,
	`cancellation_effective_at` integer,
	`price_amount` integer,
	`price_currency` text,
	PRIMARY KEY(`event_source`, `event_id`),
	FOREIGN KEY (`event_source`,`event_id`) REFERENCES `shopify_events`(`source`,`event_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shopify_sync_checkpoints` (
	`name` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`watermark_at` integer,
	`last_succeeded_at` integer,
	`last_failed_at` integer,
	`failure_code` text,
	`failure_detail` text
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`topic` text NOT NULL,
	`api_version` text NOT NULL,
	`shop` text NOT NULL,
	`triggered_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`processing_started_at` integer,
	`processed_at` integer,
	`failed_at` integer,
	`failure_code` text,
	`failure_detail` text
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_shop_received_idx` ON `webhook_deliveries` (`shop`,`received_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_received_idx` ON `webhook_deliveries` (`status`,`received_at`);--> statement-breakpoint
ALTER TABLE `shops` ADD `shopify_shop_id` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `relationship_status` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `relationship_occurred_at` integer;--> statement-breakpoint
ALTER TABLE `shops` ADD `relationship_external_id` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `current_installed_at` integer;--> statement-breakpoint
ALTER TABLE `shops` ADD `last_authenticated_at` integer;--> statement-breakpoint
ALTER TABLE `shops` ADD `last_webhook_at` integer;--> statement-breakpoint
ALTER TABLE `shops` ADD `last_reconciled_at` integer;--> statement-breakpoint
CREATE INDEX `shops_relationship_status_idx` ON `shops` (`relationship_status`);