import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";


/**
 * D1 schema. Regenerate migrations after every change:
 *   npm run db:generate && npm run db:migrate:local
 *
 * Shopify SESSIONS DO NOT LIVE HERE — they're in Cloudflare KV
 * (app/session-storage.server.ts), because the Shopify library reads and writes
 * them on nearly every request and KV is the cheaper store for that shape.
 *
 * `shops` below is the one example table, and the install record every Shopify
 * app ends up needing. Delete it if your app tracks nothing per shop.
 */
export const shops = sqliteTable(
  "shops",
  {
    // The myshopify.com domain — the natural tenant key for every query.
    shop: text("shop").primaryKey(),
    /** Shopify's stable shop GID once an authoritative lifecycle event provides it. */
    shopifyShopId: text("shopify_shop_id"),
    /** The current relationship projection; null only for rows predating lifecycle tracking. */
    relationshipStatus: text("relationship_status", {
      enum: ["INSTALLED", "UNINSTALLED", "DEACTIVATED", "REACTIVATED"],
    }),
    /** The deterministic ordering key for the relationship projection. */
    relationshipOccurredAt: integer("relationship_occurred_at"),
    relationshipExternalId: text("relationship_external_id"),
    installedAt: integer("installed_at").notNull(),
    currentInstalledAt: integer("current_installed_at"),
    uninstalledAt: integer("uninstalled_at"),
    lastAuthenticatedAt: integer("last_authenticated_at"),
    lastWebhookAt: integer("last_webhook_at"),
    lastReconciledAt: integer("last_reconciled_at"),
  },
  (table) => [
    index("shops_uninstalled_at_idx").on(table.uninstalledAt),
    index("shops_relationship_status_idx").on(table.relationshipStatus),
  ],
);

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
