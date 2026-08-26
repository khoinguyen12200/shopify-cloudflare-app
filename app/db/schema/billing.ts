import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { money, nullableMoney } from "../columns";


/**
 * Every `app_subscriptions/update` webhook DELIVERY, in full — this app's own
 * paper trail for "who is on what plan, and when did that change". One row per
 * delivery, never updated in place: a shop's history is every row for it,
 * ordered by `shopifyUpdatedAt`. The internal console reads this table; the
 * merchant-facing billing page does not (it asks Shopify live instead — see
 * `app/billing/`).
 *
 * Deliveries are at-least-once, so `(subscriptionId, shopifyUpdatedAt)` is
 * UNIQUE — Shopify's own timestamp for the update is the natural dedupe key: a
 * replay of the same event has the same pair, a real change does not.
 */
export const subscriptionEvents = sqliteTable(
  "subscription_events",
  {
    id: text("id").primaryKey(),
    shop: text("shop").notNull(),
    /** Shopify's AppSubscription GID — stable for the life of the subscription. */
    subscriptionId: text("subscription_id").notNull(),
    /** The plan name Shopify reports — see app/billing/plans.ts for what this app named it. */
    name: text("name").notNull(),
    status: text("status", {
      enum: [
        "ACTIVE",
        "CANCELLED",
        "PENDING",
        "DECLINED",
        "EXPIRED",
        "FROZEN",
        "ACCEPTED",
      ],
    }).notNull(),
    /** Only present once a Managed Pricing plan is configured in the Dashboard — TODO, see app/billing/plans.ts. */
    planHandle: text("plan_handle"),
    /** "every_30_days" | "annual", as Shopify sends it. Null for a one-time/usage charge. */
    interval: text("interval"),
    ...money("price"),
    ...nullableMoney("cappedAmount", "capped_amount"),
    /** Shopify's own "when this changed" — the dedupe key, paired with subscriptionId. */
    shopifyUpdatedAt: integer("shopify_updated_at").notNull(),
    shopifyCreatedAt: integer("shopify_created_at").notNull(),
    /** When THIS delivery was processed — distinct from shopifyUpdatedAt. */
    receivedAt: integer("received_at").notNull(),
  },
  (table) => [
    index("subscription_events_shop_idx").on(table.shop),
    index("subscription_events_subscription_idx").on(table.subscriptionId),
    uniqueIndex("subscription_events_dedupe_idx").on(
      table.subscriptionId,
      table.shopifyUpdatedAt,
    ),
  ],
);

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEvent = typeof subscriptionEvents.$inferInsert;
export type SubscriptionStatus = SubscriptionEvent["status"];
