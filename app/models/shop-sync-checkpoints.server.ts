import { eq } from "drizzle-orm";
import { shopifySyncCheckpoints, type ShopifySyncCheckpoint } from "~/db/schema";
import { getDb } from "~/request-context.server";

export type SyncCheckpoint = ShopifySyncCheckpoint;

export class ShopSyncCheckpointRepo {
  async read(name: string): Promise<SyncCheckpoint | null> {
    const [row] = await getDb().select().from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, name)).limit(1);
    return row ?? null;
  }

  async markSucceeded(name: string, cursor: string | null, watermarkAt: number, now: number): Promise<void> {
    await getDb().insert(shopifySyncCheckpoints).values({ name, cursor, watermarkAt, lastSucceededAt: now, lastFailedAt: null, failureCode: null, failureDetail: null }).onConflictDoUpdate({ target: shopifySyncCheckpoints.name, set: { cursor, watermarkAt, lastSucceededAt: now, lastFailedAt: null, failureCode: null, failureDetail: null } });
  }

  async markFailed(name: string, code: string, detail: string, now: number): Promise<void> {
    await getDb().insert(shopifySyncCheckpoints).values({ name, lastFailedAt: now, failureCode: code, failureDetail: detail.slice(0, 1000) }).onConflictDoUpdate({ target: shopifySyncCheckpoints.name, set: { lastFailedAt: now, failureCode: code, failureDetail: detail.slice(0, 1000) } });
  }

  async readCheckpoint(name: string): Promise<SyncCheckpoint | null> { return this.read(name); }
  async markCheckpointSucceeded(name: string, cursor: string | null, watermarkAt: number, now: number): Promise<void> { return this.markSucceeded(name, cursor, watermarkAt, now); }
  async markCheckpointFailed(name: string, code: string, detail: string, now: number): Promise<void> { return this.markFailed(name, code, detail, now); }
}

export const CheckpointRepo = ShopSyncCheckpointRepo;
