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

/**
 * Staff who can sign in to the internal console at `/internal`.
 *
 * NOT shop-scoped, and that is the one deliberate exception to the shop-scoping
 * rule in @rules/data.md: these are *your* team, not a merchant's records. Every
 * other table stays shop-scoped.
 *
 * Never a merchant or a customer. The internal console is for operating the app;
 * merchants use the embedded Shopify admin.
 */
export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    /** Lower-cased on write, so lookups are case-insensitive without a collation. */
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    /** PBKDF2, self-describing — see app/lib/password.ts. Never plaintext. */
    passwordHash: text("password_hash").notNull(),
    /**
     * `owner` can manage other staff; `admin` cannot. The last active owner can
     * never be removed or demoted — see AdminUserRepo.
     */
    role: text("role", { enum: ["owner", "admin"] })
      .notNull()
      .default("admin"),
    /**
     * Disabling beats deleting: it keeps the audit trail while revoking access
     * immediately. Deletion stays available for a mistake or a GDPR request.
     */
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastLoginAt: integer("last_login_at"),
  },
  (table) => [
    index("admin_users_email_idx").on(table.email),
    index("admin_users_status_idx").on(table.status),
  ],
);

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type AdminRole = AdminUser["role"];
export type AdminStatus = AdminUser["status"];

/** What is safe to send to the browser: never the password hash. */
export type SafeAdminUser = Omit<AdminUser, "passwordHash">;

/**
 * Single-use password-reset tokens for the internal console.
 *
 * ONLY A HASH OF THE TOKEN IS STORED. The token itself exists in exactly two
 * places: the email that was sent, and the URL the recipient clicks. A database
 * leak therefore hands an attacker nothing usable — the same reason
 * `admin_users` stores a password hash rather than a password.
 *
 * Rows are kept after use rather than deleted, so `used_at` can prove a token
 * was already spent (a deleted row is indistinguishable from one that never
 * existed, which makes replay impossible to report accurately).
 */
export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    /** SHA-256 of the token, hex. Never the token. */
    tokenHash: text("token_hash").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    /** Set the moment it is spent. A non-null value means the token is dead. */
    usedAt: integer("used_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("password_reset_tokens_user_idx").on(table.adminUserId),
    index("password_reset_tokens_expires_idx").on(table.expiresAt),
  ],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
