import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopSyncCheckpointRepo } from "./shop-sync-checkpoints.server";

setupTestDatabase();
const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

describe("ShopSyncCheckpointRepo", () => {
  it("stores success and bounded failure metadata", async () => {
    const checkpoint = await inRequest(async () => {
      const repo = new ShopSyncCheckpointRepo();
      await repo.markSucceeded("history", "cursor-1", 10, 11);
      await repo.markFailed("history", "TIMEOUT", "x".repeat(2000), 12);
      return repo.read("history");
    });
    expect(checkpoint?.cursor).toBe("cursor-1");
    expect(checkpoint?.failureDetail).toHaveLength(1000);
    expect(checkpoint?.lastFailedAt).toBe(12);
  });
});
