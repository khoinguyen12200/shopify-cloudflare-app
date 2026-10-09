import { eq, inArray } from "drizzle-orm";
import { redactedShops } from "~/db/schema";
import type { RedactedShopsPort } from "~/ports/redacted-shops";
import { getDb } from "~/request-context.server";

/**
 * The sole D1 adapter for redaction tombstones. Keyed by shop hash rather than a shop column — see the schema file for
 * why this table is the exception to shop-scoping. The purge writes its tombstone inside its own batch
 * (`TenantPurgeRepo.deleteTenantRows`), not through here, so the erase and the mark are one commit.
 */
export class RedactedShopRepo implements RedactedShopsPort {
  async mark(shopHash: string, redactedAt: number): Promise<void> {
    await getDb().insert(redactedShops).values({ shopHash, redactedAt }).onConflictDoNothing();
  }

  async isRedacted(shopHash: string): Promise<boolean> {
    const rows = await getDb().select({ shopHash: redactedShops.shopHash }).from(redactedShops).where(eq(redactedShops.shopHash, shopHash)).limit(1);
    return rows.length === 1;
  }

  async clear(shopHash: string): Promise<boolean> {
    const removed = await getDb().delete(redactedShops).where(eq(redactedShops.shopHash, shopHash)).returning({ shopHash: redactedShops.shopHash });
    return removed.length === 1;
  }

  async findRedacted(shopHashes: readonly string[]): Promise<ReadonlySet<string>> {
    if (shopHashes.length === 0) return new Set();
    const rows = await getDb().select({ shopHash: redactedShops.shopHash }).from(redactedShops).where(inArray(redactedShops.shopHash, [...shopHashes]));
    return new Set(rows.map((row) => row.shopHash));
  }
}
