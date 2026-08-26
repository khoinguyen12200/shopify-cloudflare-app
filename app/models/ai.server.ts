import { and, desc, eq, sql } from "drizzle-orm";
import { aiModels, aiRuns, type AiModel, type AiRun } from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { ModelRole } from "~/ai/roles";
import { orderChain } from "~/ai/chain";
import type { AiFailureReason } from "~/ports/ai";

/**
 * The ONLY place `ai_models` and `ai_runs` are queried.
 *
 * Neither table is shop-scoped — see the schema for why — so these methods take
 * no `shop` first parameter. That is the documented exception, not the pattern
 * (@rules/data.md).
 */
export class AiRepo {
  /** One purpose's chain, in the order to try it. */
  async chainFor(role: ModelRole, now: number): Promise<string[]> {
    const rows = await getDb()
      .select({
        modelId: aiModels.modelId,
        priority: aiModels.priority,
        enabled: aiModels.enabled,
        healthy: aiModels.healthy,
        lastFailedAt: aiModels.lastFailedAt,
      })
      .from(aiModels)
      .where(eq(aiModels.role, role));

    // The ordering policy is pure and lives in ~/ai/chain.
    return orderChain(rows, now);
  }

  /** Every purpose's rows, for the settings screen. One query. */
  async allModels(): Promise<AiModel[]> {
    return getDb().select().from(aiModels).orderBy(aiModels.role, aiModels.priority);
  }

  /** Add a model to a purpose's chain, at the end. Idempotent. */
  async addToChain(input: {
    role: ModelRole;
    modelId: string;
    updatedBy: string | null;
    at: number;
  }): Promise<void> {
    const [last] = await getDb()
      .select({ priority: aiModels.priority })
      .from(aiModels)
      .where(eq(aiModels.role, input.role))
      .orderBy(desc(aiModels.priority))
      .limit(1);

    await getDb()
      .insert(aiModels)
      .values({
        role: input.role,
        modelId: input.modelId,
        priority: (last?.priority ?? -1) + 1,
        enabled: true,
        healthy: true,
        lastFailedAt: null,
        updatedAt: input.at,
        updatedBy: input.updatedBy,
      })
      // Already in this chain: leave its place alone rather than moving it to
      // the end, which is not what "add" means to someone who clicked twice.
      .onConflictDoNothing();
  }

  async removeFromChain(role: ModelRole, modelId: string): Promise<void> {
    await getDb()
      .delete(aiModels)
      .where(and(eq(aiModels.role, role), eq(aiModels.modelId, modelId)));
  }

  /** Move one model up or down its chain by swapping priorities with its neighbour. */
  async reorder(input: {
    role: ModelRole;
    modelId: string;
    direction: "up" | "down";
    at: number;
  }): Promise<void> {
    const rows = await getDb()
      .select({ modelId: aiModels.modelId, priority: aiModels.priority })
      .from(aiModels)
      .where(eq(aiModels.role, input.role))
      .orderBy(aiModels.priority);

    const index = rows.findIndex((row) => row.modelId === input.modelId);
    if (index === -1) return;

    const swapWith = input.direction === "up" ? index - 1 : index + 1;
    const a = rows[index];
    const b = rows[swapWith];
    // Already at the end it is being moved towards: nothing to do.
    if (!a || !b) return;

    await getDb()
      .update(aiModels)
      .set({ priority: b.priority, updatedAt: input.at })
      .where(and(eq(aiModels.role, input.role), eq(aiModels.modelId, a.modelId)));
    await getDb()
      .update(aiModels)
      .set({ priority: a.priority, updatedAt: input.at })
      .where(and(eq(aiModels.role, input.role), eq(aiModels.modelId, b.modelId)));
  }

  async setEnabled(input: {
    role: ModelRole;
    modelId: string;
    enabled: boolean;
    at: number;
  }): Promise<void> {
    await getDb()
      .update(aiModels)
      .set({ enabled: input.enabled, updatedAt: input.at })
      .where(and(eq(aiModels.role, input.role), eq(aiModels.modelId, input.modelId)));
  }

  /**
   * Runtime health, written by the service after every attempt.
   *
   * A success CLEARS a prior failure, so one bad minute does not sideline a
   * model for the rest of the recovery window.
   */
  async markHealth(input: {
    role: ModelRole;
    modelId: string;
    healthy: boolean;
    at: number;
  }): Promise<void> {
    await getDb()
      .update(aiModels)
      .set({
        healthy: input.healthy,
        lastFailedAt: input.healthy ? null : input.at,
      })
      .where(and(eq(aiModels.role, input.role), eq(aiModels.modelId, input.modelId)));
  }

  /** One row per call. Never batched, never skipped. */
  async recordRun(input: Omit<AiRun, "id"> & { id?: string }): Promise<void> {
    await getDb()
      .insert(aiRuns)
      .values({ ...input, id: input.id ?? crypto.randomUUID() });
  }

  async recentRuns(limit = 50): Promise<AiRun[]> {
    return getDb().select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(limit);
  }

  /**
   * Tokens spent since `since`, for the console's cost panel.
   *
   * Summed in SQL rather than by loading rows: the ledger grows by one row per
   * call forever, and "fetch everything then reduce" is the shape that works on
   * a fixture and falls over on real data (@rules/data.md).
   */
  async tokensSince(since: number): Promise<{ input: number; output: number; calls: number }> {
    const [row] = await getDb()
      .select({
        input: sql<number>`coalesce(sum(${aiRuns.inputTokens}), 0)`,
        output: sql<number>`coalesce(sum(${aiRuns.outputTokens}), 0)`,
        calls: sql<number>`count(*)`,
      })
      .from(aiRuns)
      .where(sql`${aiRuns.createdAt} >= ${since}`);

    return {
      input: Number(row?.input ?? 0),
      output: Number(row?.output ?? 0),
      calls: Number(row?.calls ?? 0),
    };
  }
}

export type { AiFailureReason };
