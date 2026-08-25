import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { money, nullableMoney } from "./columns";

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
    /**
     * Email me when a merchant opens or replies to a support ticket.
     *
     * Per-account and on by default: a new staff member should hear about
     * tickets rather than discover the setting later. Toggled from
     * `/internal/support`. Only `active` accounts are ever notified, so
     * disabling someone also stops their mail without touching this.
     */
    notifySupport: integer("notify_support", { mode: "boolean" })
      .notNull()
      .default(true),
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

/**
 * One row per notification ATTEMPT — the system's whole paper trail.
 *
 * Written by `app/notifications/dispatch.server.ts` and nothing else. Every
 * attempt lands here, sent or not, because a side effect that did not happen
 * needs a queryable record rather than a log line nobody greps.
 *
 * `status` is OUR lifecycle; `providerStatus` is the carrier's. Two columns
 * because they are two different facts and their vocabularies overlap
 * ("queued", "sent") — sharing one column makes "did it actually arrive?"
 * unanswerable, and lets a provider callback accidentally reopen a dedupe.
 */
export const notificationLogs = sqliteTable(
  "notification_logs",
  {
    id: text("id").primaryKey(),
    /** Which notification this was. A NotificationEvent — see notifications/types.ts. */
    event: text("event").notNull(),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    /**
     * Our dispatch lifecycle:
     *   queued  — row reserved, transport not yet answered
     *   sent    — the provider accepted it
     *   failed  — attempted and failed
     *   refused — never attempted (policy, configuration, bad address)
     *
     * `refused` is distinct from `failed` on purpose. Collapsing them loses the
     * difference between "we tried and it broke" and "we declined to try", which
     * is exactly the distinction someone reading this table needs.
     */
    status: text("status", {
      enum: ["queued", "sent", "failed", "refused"],
    }).notNull(),
    /**
     * The machine-readable reason, from the RefusalReason / FailureReason unions.
     * Its own column rather than a token prefixed onto a prose string — prose
     * gets improved, and a parser over it breaks the first time someone does.
     */
    reasonCode: text("reason_code"),
    /** Human detail. Free-form, never parsed. */
    detail: text("detail"),
    /** The carrier's verdict, verbatim. */
    providerStatus: text("provider_status"),
    /** The carrier's id, so an async delivery callback can find this row. */
    providerMessageId: text("provider_message_id"),
    /**
     * Idempotency key for (event, recipient). When set, an existing `queued` or
     * `sent` row short-circuits the send, so a retried job never re-notifies.
     */
    dedupeKey: text("dedupe_key"),
    /** Optional tenant scope. Null for notifications that are not shop-specific. */
    shop: text("shop"),
    createdAt: integer("created_at").notNull(),
    settledAt: integer("settled_at"),
  },
  (table) => [
    index("notification_logs_event_idx").on(table.event),
    index("notification_logs_recipient_idx").on(table.recipient),
    index("notification_logs_dedupe_idx").on(table.dedupeKey),
    index("notification_logs_shop_idx").on(table.shop),
    index("notification_logs_created_idx").on(table.createdAt),
  ],
);

export type NotificationLog = typeof notificationLogs.$inferSelect;

/**
 * Which channels carry which event, per tenant.
 *
 * RELATIONAL, not a JSON blob. A blob needs a defensive parser, a "what if it is
 * corrupt" policy, and a migration every time its shape changes — and a
 * hand-edited or half-written value can take down every send for that tenant.
 * A row per (scope, event, channel) removes that whole class of problem: the
 * columns are typed, absence is meaningful, and a bad row affects one setting.
 *
 * ABSENCE IS THE DEFAULT. No rows for an event means "no preference", which
 * falls back to the event's declared channels. That is what lets this ship
 * without changing any existing tenant's behaviour. An explicit row with
 * `enabled = false` is different: the tenant turned that channel off.
 */
export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    /**
     * Who the preference belongs to. `"global"` is the app-wide default; a shop
     * domain scopes it to one merchant. A plain string rather than a foreign key,
     * so a preference can outlive the thing it is about.
     */
    scope: text("scope").notNull(),
    /** A NotificationEvent — see notifications/types.ts. */
    event: text("event").notNull(),
    channel: text("channel").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.event, table.channel] }),
    index("notification_preferences_scope_idx").on(table.scope),
  ],
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

/**
 * Recipients who asked not to be contacted on a channel.
 *
 * KEYED ON THE ADDRESS, not on a customer or ticket id. A person who replies
 * STOP to a text, or clicks unsubscribe, is silencing that ADDRESS — and it must
 * stay silenced everywhere it appears, including on records created later. Keying
 * on an entity id means the same phone number keeps being texted from a different
 * row, which is both a bad experience and, for SMS, a carrier violation.
 *
 * `scope` allows a per-tenant opt-out; `"global"` silences the address app-wide.
 */
export const notificationOptOuts = sqliteTable(
  "notification_opt_outs",
  {
    scope: text("scope").notNull(),
    channel: text("channel").notNull(),
    /** Lower-cased email, or E.164 phone. Normalised on write. */
    address: text("address").notNull(),
    optedOutAt: integer("opted_out_at").notNull(),
    /** How they opted out — "unsubscribe_link", "sms_stop", "staff", … */
    source: text("source"),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.channel, table.address] }),
    index("notification_opt_outs_address_idx").on(table.address),
  ],
);

export type NotificationOptOut = typeof notificationOptOuts.$inferSelect;
export type NotificationLogStatus = NotificationLog["status"];

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

/**
 * Merchant ↔ staff support threads. Merchants file and reply from the embedded
 * admin (`/app/support`); staff answer from the internal console
 * (`/internal/support`).
 *
 * `shopName` and `merchantEmail` are SNAPSHOTS taken when the ticket is filed,
 * not joins. A thread has to stay readable and answerable after the shop
 * uninstalls — at which point the live Shopify record is gone — and the address
 * the merchant wanted replies sent to is a property of the ticket, not of the
 * shop's current configuration.
 */
export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    shop: text("shop").notNull(),
    /** Snapshot — see the note above. */
    shopName: text("shop_name").notNull(),
    /** Where staff replies are emailed. Prefilled from Shopify, editable by the merchant. */
    merchantEmail: text("merchant_email"),
    /**
     * Extra addresses copied on every reply — a shared inbox, a colleague.
     * JSON because it is a short bounded list read and written whole, never
     * queried by element. Capped and deduped at the edge (app/schemas/support.ts).
     */
    ccEmails: text("cc_emails", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    category: text("category", {
      enum: ["bug", "feature_request", "billing", "question"],
    }).notNull(),
    subject: text("subject").notNull(),
    /**
     * There is deliberately NO `status` column.
     *
     * "Whose turn is it" IS "who spoke last": the merchant wrote, so it is ours;
     * we wrote, so it is theirs. Storing that as a third fact lets it disagree
     * with the messages — the classic helpdesk bug where a thread shows a reply
     * but still reads OPEN. So the two facts below are written in the same
     * operation as every message, and the status a human sees is DERIVED from
     * them by a pure function (`app/support/status.ts`).
     *
     * It also makes reopen-on-reply free: a merchant answering a closed ticket
     * clears `closedAt` in that same write, and nothing else has to know.
     */
    lastAuthor: text("last_author", { enum: ["merchant", "staff"] }).notNull(),
    /** Sort key for the queue, and half of the unread comparison below. */
    lastMessageAt: integer("last_message_at").notNull(),
    /** Null while the thread is live. Set when either side closes it. */
    closedAt: integer("closed_at"),
    /**
     * Read receipts as TIMESTAMPS, not booleans: unread is
     * `lastMessageAt > xLastReadAt`, which cannot drift out of step with the
     * messages the way a flag someone forgot to clear does. Null = never opened.
     */
    merchantLastReadAt: integer("merchant_last_read_at"),
    staffLastReadAt: integer("staff_last_read_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("support_tickets_shop_idx").on(table.shop),
    // The staff queue: live threads waiting on us, newest first. Covers the
    // derived-status filter without a stored status column.
    index("support_tickets_queue_idx").on(
      table.closedAt,
      table.lastAuthor,
      table.lastMessageAt,
    ),
    index("support_tickets_shop_recent_idx").on(table.shop, table.lastMessageAt),
  ],
);

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type SupportCategory = SupportTicket["category"];

/**
 * One message in a thread. `authorName` is a snapshot for the same reason the
 * ticket's shopName is: a staff account can be renamed or deleted, and the
 * thread still has to say who wrote what.
 */
export const supportMessages = sqliteTable(
  "support_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    /** Kept alongside ticketId so a purge and every read stay shop-scoped without a join. */
    shop: text("shop").notNull(),
    author: text("author", { enum: ["merchant", "staff"] }).notNull(),
    /** Snapshot — see the note above. */
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("support_messages_ticket_idx").on(table.ticketId, table.createdAt),
    index("support_messages_shop_idx").on(table.shop),
  ],
);

export type SupportMessage = typeof supportMessages.$inferSelect;
export type NewSupportMessage = typeof supportMessages.$inferInsert;
export type SupportAuthor = SupportMessage["author"];

/**
 * An image or video attached to a message, stored in R2.
 *
 * `r2Key` is the only handle on the object; it is read during a shop purge to
 * delete the blob before the row that names it disappears. A row without its
 * object is a broken thumbnail; an object without its row is an unreachable
 * bill, so the row is deleted second.
 */
export const supportAttachments = sqliteTable(
  "support_attachments",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => supportMessages.id, { onDelete: "cascade" }),
    /** Kept for the same reason as on supportMessages: purge and reads stay shop-scoped. */
    shop: text("shop").notNull(),
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("support_attachments_message_idx").on(table.messageId),
    index("support_attachments_shop_idx").on(table.shop),
  ],
);

export type SupportAttachment = typeof supportAttachments.$inferSelect;
export type NewSupportAttachment = typeof supportAttachments.$inferInsert;
