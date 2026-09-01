INSERT INTO `shopify_events` (`source`, `event_id`, `event_type`, `shop`, `shopify_shop_id`, `occurred_at`, `synchronized_at`)
SELECT 'legacy_migration', 'legacy:' || se.id, 'UPDATED', se.shop, s.shopify_shop_id,
  se.shopify_updated_at, se.received_at
FROM `subscription_events` se
INNER JOIN `shops` s ON s.shop = se.shop
WHERE s.shopify_shop_id IS NOT NULL
  AND se.status IN ('ACTIVE', 'CANCELLED', 'PENDING', 'FROZEN', 'ACCEPTED');
--> statement-breakpoint
INSERT INTO `shopify_subscription_events` (`event_source`, `event_id`, `subscription_id`, `status`, `plan_handle`, `billing_interval`, `price_amount`, `price_currency`)
SELECT 'legacy_migration', 'legacy:' || se.id, se.subscription_id,
  CASE se.status WHEN 'CANCELLED' THEN 'CANCELED' WHEN 'ACCEPTED' THEN 'ACTIVE' ELSE se.status END,
  se.plan_handle, se.interval, se.price_amount, se.price_currency
FROM `subscription_events` se
INNER JOIN `shops` s ON s.shop = se.shop
WHERE s.shopify_shop_id IS NOT NULL
  AND se.status IN ('ACTIVE', 'CANCELLED', 'PENDING', 'FROZEN', 'ACCEPTED');
--> statement-breakpoint
INSERT INTO `shop_subscriptions` (`shop`, `subscription_id`, `status`, `plan_handle`, `billing_interval`, `applied_occurred_at`, `applied_external_id`)
SELECT se.shop, se.subscription_id,
  CASE se.status WHEN 'CANCELLED' THEN 'CANCELED' WHEN 'ACCEPTED' THEN 'ACTIVE' ELSE se.status END,
  se.plan_handle, se.interval, se.shopify_updated_at, 'legacy:' || se.id
FROM `subscription_events` se
INNER JOIN `shops` s ON s.shop = se.shop
WHERE s.shopify_shop_id IS NOT NULL
  AND se.status IN ('ACTIVE', 'CANCELLED', 'PENDING', 'FROZEN', 'ACCEPTED')
  AND se.shopify_updated_at = (SELECT max(newer.shopify_updated_at) FROM `subscription_events` newer WHERE newer.shop = se.shop AND newer.subscription_id = se.subscription_id)
ON CONFLICT (`shop`, `subscription_id`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `shop_subscription_items` (`shop`, `subscription_id`, `position`, `item_type`, `price_amount`, `price_currency`)
SELECT se.shop, se.subscription_id, 0, 'legacy_recurring', se.price_amount, se.price_currency
FROM `subscription_events` se
WHERE se.price_amount IS NOT NULL AND se.price_currency IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `shop_subscriptions` ss
    WHERE ss.shop = se.shop AND ss.subscription_id = se.subscription_id
      AND ss.applied_external_id = 'legacy:' || se.id
  )
ON CONFLICT (`shop`, `subscription_id`, `position`) DO NOTHING;
--> statement-breakpoint
DROP TABLE `subscription_events`;
