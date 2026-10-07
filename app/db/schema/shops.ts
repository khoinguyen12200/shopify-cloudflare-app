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
    /** The merchant's shop name from Shopify Admin API. */
    name: text("name"),
    /** The account owner's email address from Shopify Admin API. */
    email: text("email"),
    /** The public-facing contact email address for the store. */
    contactEmail: text("contact_email"),
    /** Store logo or favicon URL. */
    logoUrl: text("logo_url"),
    /** Online store public URL. */
    url: text("url"),
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
    /** True if this is a development / partner test store. Excluded from real MRR. */
    isDevStore: integer("is_dev_store", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    index("shops_uninstalled_at_idx").on(table.uninstalledAt),
    index("shops_relationship_status_idx").on(table.relationshipStatus),
    index("shops_is_dev_store_idx").on(table.isDevStore),
  ],
);

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
