import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { nullableMoney } from "../columns";

/**
 * The technical inbox for authenticated Shopify deliveries. Payloads are never
 * retained: later processing has the validated fields plus an integrity hash.
 */
export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    topic: text("topic").notNull(),
    apiVersion: text("api_version").notNull(),
    shop: text("shop").notNull(),
    triggeredAt: integer("triggered_at").notNull(),
    receivedAt: integer("received_at").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status", {
      enum: ["received", "queued", "processing", "processed", "failed", "dead_letter"],
    })
      .notNull()
      .default("received"),
    attempts: integer("attempts").notNull().default(0),
    processingStartedAt: integer("processing_started_at"),
    processedAt: integer("processed_at"),
    failedAt: integer("failed_at"),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
  },
  (table) => [
    index("webhook_deliveries_shop_received_idx").on(table.shop, table.receivedAt),
    index("webhook_deliveries_status_received_idx").on(table.status, table.receivedAt),
  ],
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

/** Normalized values needed by a queued scope-update consumer; never raw JSON. */
export const webhookScopeObservations = sqliteTable(
  "webhook_scope_observations",
  {
    deliveryId: text("delivery_id")
      .notNull()
      .references(() => webhookDeliveries.id, { onDelete: "cascade" }),
    shop: text("shop").notNull(),
    scope: text("scope").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.deliveryId, table.scope] }),
    index("webhook_scope_observations_shop_idx").on(table.shop),
  ],
);

/** Immutable facts observed from Shopify, not the transport attempts that carried them. */
export const shopifyEvents = sqliteTable(
  "shopify_events",
  {
    source: text("source", {
      enum: ["partner_history", "webhook_observation", "authenticated_access"],
    }).notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    shop: text("shop").notNull(),
    shopifyShopId: text("shopify_shop_id").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    synchronizedAt: integer("synchronized_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.eventId] }),
    index("shopify_events_shop_occurred_idx").on(table.shop, table.occurredAt),
  ],
);

export type ShopifyEvent = typeof shopifyEvents.$inferSelect;
export type NewShopifyEvent = typeof shopifyEvents.$inferInsert;

/** Typed details for relationship lifecycle facts; never an unvalidated JSON blob. */
export const shopifyRelationshipEvents = sqliteTable(
  "shopify_relationship_events",
  {
    eventSource: text("event_source").notNull(),
    eventId: text("event_id").notNull(),
    reason: text("reason"),
    reasonDescription: text("reason_description"),
  },
  (table) => [
    primaryKey({ columns: [table.eventSource, table.eventId] }),
    foreignKey({
      columns: [table.eventSource, table.eventId],
      foreignColumns: [shopifyEvents.source, shopifyEvents.eventId],
      name: "shopify_relationship_events_event_fk",
    }).onDelete("cascade"),
  ],
);

export type ShopifyRelationshipEvent = typeof shopifyRelationshipEvents.$inferSelect;

/** Typed details for Managed Pricing historical subscription facts. */
export const shopifySubscriptionEvents = sqliteTable(
  "shopify_subscription_events",
  {
    eventSource: text("event_source").notNull(),
    eventId: text("event_id").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    status: text("status", {
      enum: [
        "NONE",
        "PENDING",
        "ACTIVE",
        "CANCELLATION_SCHEDULED",
        "FROZEN",
        "CANCELED",
        "UNKNOWN",
      ],
    }).notNull(),
    planHandle: text("plan_handle"),
    billingInterval: text("billing_interval"),
    trialEndsAt: integer("trial_ends_at"),
    currentPeriodEndsAt: integer("current_period_ends_at"),
    cancellationEffectiveAt: integer("cancellation_effective_at"),
    ...nullableMoney("price"),
  },
  (table) => [
    primaryKey({ columns: [table.eventSource, table.eventId] }),
    foreignKey({
      columns: [table.eventSource, table.eventId],
      foreignColumns: [shopifyEvents.source, shopifyEvents.eventId],
      name: "shopify_subscription_events_event_fk",
    }).onDelete("cascade"),
  ],
);

export type ShopifySubscriptionEvent = typeof shopifySubscriptionEvents.$inferSelect;

/** The current Managed Pricing state, keyed by the subscription Shopify identifies. */
export const shopSubscriptions = sqliteTable(
  "shop_subscriptions",
  {
    shop: text("shop").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    status: text("status", {
      enum: [
        "NONE",
        "PENDING",
        "ACTIVE",
        "CANCELLATION_SCHEDULED",
        "FROZEN",
        "CANCELED",
        "UNKNOWN",
      ],
    }).notNull(),
    planHandle: text("plan_handle"),
    billingInterval: text("billing_interval"),
    trialEndsAt: integer("trial_ends_at"),
    currentPeriodEndsAt: integer("current_period_ends_at"),
    cancellationEffectiveAt: integer("cancellation_effective_at"),
    appliedOccurredAt: integer("applied_occurred_at").notNull(),
    appliedExternalId: text("applied_external_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.subscriptionId] }),
    index("shop_subscriptions_shop_status_idx").on(table.shop, table.status),
  ],
);

export type ShopSubscription = typeof shopSubscriptions.$inferSelect;

/** The potentially multiple current pricing items on a Managed Pricing subscription. */
export const shopSubscriptionItems = sqliteTable(
  "shop_subscription_items",
  {
    shop: text("shop").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    position: integer("position").notNull(),
    itemType: text("item_type").notNull(),
    ...nullableMoney("price"),
    ...nullableMoney("cappedAmount", "capped_amount"),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.subscriptionId, table.position] }),
    foreignKey({
      columns: [table.shop, table.subscriptionId],
      foreignColumns: [shopSubscriptions.shop, shopSubscriptions.subscriptionId],
      name: "shop_subscription_items_subscription_fk",
    }).onDelete("cascade"),
  ],
);

export type ShopSubscriptionItem = typeof shopSubscriptionItems.$inferSelect;

/** The normalized current OAuth scope set. */
export const shopGrantedScopes = sqliteTable(
  "shop_granted_scopes",
  {
    shop: text("shop").notNull(),
    scope: text("scope").notNull(),
    grantedAt: integer("granted_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.scope] }),
    index("shop_granted_scopes_scope_idx").on(table.scope),
  ],
);

export type ShopGrantedScope = typeof shopGrantedScopes.$inferSelect;

/** The append-only history of each observed scope-set change. */
export const shopScopeChanges = sqliteTable(
  "shop_scope_changes",
  {
    id: text("id").primaryKey(),
    shop: text("shop").notNull(),
    source: text("source", { enum: ["webhook", "authenticated_access"] }).notNull(),
    occurredAt: integer("occurred_at").notNull(),
  },
  (table) => [index("shop_scope_changes_shop_occurred_idx").on(table.shop, table.occurredAt)],
);

export type ShopScopeChange = typeof shopScopeChanges.$inferSelect;

/** One row per scope added or removed in a scope history entry. */
export const shopScopeChangeItems = sqliteTable(
  "shop_scope_change_items",
  {
    scopeChangeId: text("scope_change_id")
      .notNull()
      .references(() => shopScopeChanges.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    change: text("change", { enum: ["granted", "revoked"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scopeChangeId, table.scope] })],
);

export type ShopScopeChangeItem = typeof shopScopeChangeItems.$inferSelect;

/** App-owned operational state for the cursor-based Partner history synchronizer. */
export const shopifySyncCheckpoints = sqliteTable("shopify_sync_checkpoints", {
  name: text("name").primaryKey(),
  cursor: text("cursor"),
  watermarkAt: integer("watermark_at"),
  lastSucceededAt: integer("last_succeeded_at"),
  lastFailedAt: integer("last_failed_at"),
  failureCode: text("failure_code"),
  failureDetail: text("failure_detail"),
});

export type ShopifySyncCheckpoint = typeof shopifySyncCheckpoints.$inferSelect;
