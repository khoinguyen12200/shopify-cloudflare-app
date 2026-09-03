ALTER TABLE `shop_subscriptions` ADD `current_period_starts_at` integer;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_plan_handle` text;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_billing_interval` text;--> statement-breakpoint
ALTER TABLE `shop_subscriptions` ADD `pending_legacy_subscription_id` text;

-- Current projection identity is now one row per app/shop. Remove rows written
-- under legacy event or subscription IDs so listCurrent cannot double count.
DELETE FROM `shop_subscription_items`
WHERE EXISTS (
  SELECT 1 FROM `shop_subscriptions` s
  WHERE s.shop = `shop_subscription_items`.shop
    AND s.subscription_id = `shop_subscription_items`.subscription_id
    AND s.subscription_id NOT LIKE 'active:%'
);
DELETE FROM `shop_subscriptions` WHERE `subscription_id` NOT LIKE 'active:%';
