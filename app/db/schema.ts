/**
 * D1 schema. Regenerate migrations after every change:
 *   npm run db:generate && npm run db:migrate:local
 *
 * Shopify SESSIONS DO NOT LIVE HERE — they're in Cloudflare KV
 * (app/session-storage.server.ts), because the Shopify library reads and writes
 * them on nearly every request and KV is the cheaper store for that shape.
 *
 * THE BARREL, and the only thing anything imports (`~/db/schema`). The tables
 * are grouped by domain under `./schema/` so no one file carries every table —
 * @rules/architecture.md caps a file at 700 lines and targets 400, and this had
 * grown past the target.
 *
 * `drizzle.config.ts` still points here, so migration generation sees exactly
 * the same set of tables it did before the split. That is the check that this
 * was a pure move: regenerating produces no new migration.
 */
export * from "./schema/shops";
export * from "./schema/admin-users";
export * from "./schema/notifications";
export * from "./schema/billing";
export * from "./schema/support";
