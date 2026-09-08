ALTER TABLE `shop_subscriptions` ADD `cancel_effective_on` text;--> statement-breakpoint
ALTER TABLE `shopify_subscription_events` ADD `cancel_effective_on` text;
ALTER TABLE `shop_subscriptions` ADD `revision` integer NOT NULL DEFAULT 1;
