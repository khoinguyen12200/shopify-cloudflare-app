import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

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
    installedAt: integer("installed_at").notNull(),
    uninstalledAt: integer("uninstalled_at"),
  },
  (table) => [index("shops_uninstalled_at_idx").on(table.uninstalledAt)],
);

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
