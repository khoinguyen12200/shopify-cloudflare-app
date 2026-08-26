import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { MODEL_ROLES } from "~/ai/roles";

/**
 * Which models serve which PURPOSE, in the order to try them.
 *
 * A CHAIN rather than one row per purpose, because one model per purpose has
 * two failure modes and no answer to either: it leaves the feature dead when
 * that model misbehaves, and it forces one choice to be simultaneously the
 * cheapest thing that can restate a number and the most capable thing that can
 * hold a conversation. `priority` ascending is the order; 0 is tried first.
 *
 * `healthy` / `lastFailedAt` are written by the runtime, not by an admin. A
 * model that just failed is DEMOTED to the back of its own chain for a recovery
 * window, never dropped — dropping could empty a purpose entirely, and a
 * degraded answer beats no answer.
 *
 * The model id is checked against the catalogue on the way in, which is why the
 * console offers a select. NOT shop-scoped, deliberately, and one of only two
 * tables that are not: which model serves a purpose is OUR operational choice,
 * the same for every merchant and paid for by us. Not a precedent
 * (@rules/architecture.md).
 */
export const aiModels = sqliteTable(
  "ai_models",
  {
    /** The purpose — see app/ai/roles.ts. */
    role: text("role", { enum: MODEL_ROLES }).notNull(),
    /** A Workers AI identifier, e.g. "@cf/openai/gpt-oss-120b". */
    modelId: text("model_id").notNull(),
    /** Ascending. 0 is tried first. */
    priority: integer("priority").notNull().default(0),
    /** An admin can park a model without losing its place in the order. */
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Runtime health. Cleared by a failed call, restored by a successful one. */
    healthy: integer("healthy", { mode: "boolean" }).notNull().default(true),
    lastFailedAt: integer("last_failed_at"),
    updatedAt: integer("updated_at").notNull(),
    /** Who last changed it, for the audit trail the console needs. */
    updatedBy: text("updated_by"),
  },
  (table) => [
    // One row per (purpose, model): the same model may serve two purposes, but
    // never twice within one chain.
    primaryKey({ columns: [table.role, table.modelId] }),
    index("ai_models_role_priority_idx").on(table.role, table.priority),
  ],
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
