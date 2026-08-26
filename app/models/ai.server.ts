import { desc, eq, sql } from "drizzle-orm";
import { aiModels, aiRuns, type AiModel, type AiRun } from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { ModelRole } from "~/ai/roles";
import type { AiFailureReason } from "~/ports/ai";

/**
 * The ONLY place `ai_models` and `ai_runs` are queried.
 *
 * Neither table is shop-scoped — see the schema for why — so these methods take
 * no `shop` first parameter. That is the documented exception, not the pattern
 * (@rules/data.md).
 */
export class AiRepo {
  /** Which model serves this role, or null when nobody has chosen one. */
  async modelFor(role: ModelRole): Promise<string | null> {
    const [row] = await getDb()
      .select({ modelId: aiModels.modelId })
      .from(aiModels)
      .where(eq(aiModels.role, role))
      .limit(1);
    return row?.modelId ?? null;
  }

  /** Every role's current choice, for the settings screen. One query. */
  async allModels(): Promise<AiModel[]> {
    return getDb().select().from(aiModels);
  }

  /** Idempotent: choosing the same model twice is not an error. */
  async setModel(input: {
    role: ModelRole;
    modelId: string;
    updatedBy: string | null;
    at: number;
  }): Promise<void> {
    await getDb()
      .insert(aiModels)
      .values({
        role: input.role,
        modelId: input.modelId,
        updatedAt: input.at,
        updatedBy: input.updatedBy,
      })
      .onConflictDoUpdate({
        target: aiModels.role,
        set: { modelId: input.modelId, updatedAt: input.at, updatedBy: input.updatedBy },
      });
  }

  /** Stop using a role entirely — the feature degrades to "no draft". */
  async clearModel(role: ModelRole): Promise<void> {
    await getDb().delete(aiModels).where(eq(aiModels.role, role));
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
