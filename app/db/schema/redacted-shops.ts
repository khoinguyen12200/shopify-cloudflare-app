import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Redaction tombstones: the minimum we must remember AFTER `shop/redact` has erased a shop, so the shop is not
 * silently recreated by Partner history, a late webhook or a sweep. Shopify's docs are silent on reinstalls and
 * tombstones, so this is our own design (see `.claude/rules/shopify-api-invariants.md`).
 *
 * NOT shop-scoped, and the second deliberate exception to the shop-scoping rule in @rules/data.md (after
 * `admin_users`): it exists precisely because the shop's rows are gone, and it has no `shop` column on purpose — so
 * the tenant-purge coverage guard (which keys on a `shop` column) correctly never deletes it.
 *
 * It holds ONLY a hash and a timestamp: never the domain, a Shopify id, a name or an email.
 */
export const redactedShops = sqliteTable("redacted_shops", {
  /** SHA-256 hex of the lower-cased shop domain (`ShopHasher`). One-way; the domain is not stored. */
  shopHash: text("shop_hash").primaryKey(),
  redactedAt: integer("redacted_at").notNull(),
});

export type RedactedShop = typeof redactedShops.$inferSelect;
