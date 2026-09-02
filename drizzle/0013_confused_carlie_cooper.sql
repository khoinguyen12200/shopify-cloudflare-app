ALTER TABLE `shop_subscriptions` ADD `current_period_starts_at` integer;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_plan_handle` text;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_billing_interval` text;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_legacy_subscription_id` text;