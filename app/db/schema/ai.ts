import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { MODEL_ROLES } from "~/ai/roles";

/**
 * Which model serves which PURPOSE. One row per role, chosen in the console.
 *
 * A settings table rather than a constant because @rules/cloudflare.md forbids a
 * feature hardcoding a model id: models are retired, and a pinned id fails at
 * call time as a broken feature rather than as a bad setting. The id is checked
 * against the catalogue on the way in, which is why the console offers a select.
 *
 * NOT shop-scoped, deliberately, and one of only two tables that are not: the
 * model behind a role is OUR operational choice, the same for every merchant,
 * and paid for by us. Do not treat this as a precedent (@rules/architecture.md).
 */
export const aiModels = sqliteTable(
  "ai_models",
  {
    /** The purpose. One row each — see app/ai/roles.ts. */
    role: text("role", { enum: MODEL_ROLES }).primaryKey(),
    /** A Workers AI identifier, e.g. "@cf/openai/gpt-oss-120b". */
    modelId: text("model_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
    /** Who last changed it, for the audit trail the console needs. */
    updatedBy: text("updated_by"),
  },
);

export type AiModel = typeof aiModels.$inferSelect;

/**
 * Every AI call, one row.
 *
 * The same contract `notification_logs` has: there is no way to spend tokens
 * without leaving a record. Metered on TOKENS rather than calls because tokens
 * are what cost money, and an AI surface nobody can cost is an unbounded bill.
 *
 * `shop` is NULLABLE on purpose: support drafting is OUR spend, on our own
 * staff console, not a merchant's. Billing it to their row would misattribute
 * the cost of work they never asked for.
 */
export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: text("id").primaryKey(),
    /** Which purpose was asked for, so cost can be read per role. */
    role: text("role", { enum: MODEL_ROLES }).notNull(),
    /** What the role resolved to AT THE TIME — not a join, so history survives a model swap. */
    modelId: text("model_id").notNull(),
    /** A stable name for the calling feature, e.g. "support.reply_draft". */
    feature: text("feature").notNull(),
    shop: text("shop"),
    status: text("status", { enum: ["ok", "error"] }).notNull(),
    /** An `AiFailureReason` when status is error. */
    reasonCode: text("reason_code"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("ai_runs_created_idx").on(table.createdAt),
    index("ai_runs_role_created_idx").on(table.role, table.createdAt),
    uniqueIndex("ai_runs_id_uidx").on(table.id),
  ],
);

export type AiRun = typeof aiRuns.$inferSelect;
