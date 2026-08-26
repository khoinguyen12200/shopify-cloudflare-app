import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";


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
