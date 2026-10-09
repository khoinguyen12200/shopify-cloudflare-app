import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { makeDb } from "~/db/client";
import { shopifySyncCheckpoints, shops } from "~/db/schema";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "./shops.server";
import { ShopTokenProbeRepo } from "./shop-token-probes.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const probes = new ShopTokenProbeRepo();
const HOUR = 3_600_000;
const COOLDOWN = 20 * HOUR;
const checkpoint = (shop: string) => makeDb(env.DB).select().from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, `uninstall_probe:${shop}`)).get();

async function installed(...names: string[]) {
  const repo = new ShopRepo();
  for (const shop of names) await repo.recordInstall(shop, 1);
}

describe("ShopTokenProbeRepo.listDue", () => {
  it("lists installed shops only, never an uninstalled one", async () => {
    const due = await inRequest(async () => {
      await installed("live.myshopify.com", "gone.myshopify.com");
      await new ShopRepo().applyUninstall("gone.myshopify.com", { kind: "uninstalled", occurredAt: 5, externalId: "u" });
      return probes.listDue(10 * HOUR, COOLDOWN, 10);
    });
    expect(due).toEqual(["live.myshopify.com"]);
  });

  it("returns at most `limit` shops, never-probed first, then least recently attempted", async () => {
    const now = 100 * HOUR;
    const due = await inRequest(async () => {
      await installed("a.myshopify.com", "b.myshopify.com", "c.myshopify.com", "d.myshopify.com");
      await probes.acquireLease("b.myshopify.com", now - 40 * HOUR, 1);
      await probes.release("b.myshopify.com", { succeeded: true, at: now - 40 * HOUR });
      await probes.acquireLease("c.myshopify.com", now - 30 * HOUR, 1);
      await probes.release("c.myshopify.com", { succeeded: true, at: now - 30 * HOUR });
      return { all: await probes.listDue(now, COOLDOWN, 10), capped: await probes.listDue(now, COOLDOWN, 3) };
    });
    expect(due.all).toEqual(["a.myshopify.com", "d.myshopify.com", "b.myshopify.com", "c.myshopify.com"]);
    expect(due.capped).toEqual(["a.myshopify.com", "d.myshopify.com", "b.myshopify.com"]);
  });

  it("skips a shop probed inside the cooldown, and one whose lease is live", async () => {
    const now = 100 * HOUR;
    const due = await inRequest(async () => {
      await installed("recent.myshopify.com", "leased.myshopify.com", "due.myshopify.com");
      await probes.acquireLease("recent.myshopify.com", now - HOUR, 1);
      await probes.release("recent.myshopify.com", { succeeded: true, at: now - HOUR });
      await probes.acquireLease("leased.myshopify.com", now - 1_000, 60_000);
      return probes.listDue(now, COOLDOWN, 10);
    });
    expect(due).toEqual(["due.myshopify.com"]);
  });

  it("retries a shop whose last attempt failed, but behind shops attempted longer ago, so a failing shop cannot starve the rest", async () => {
    const now = 100 * HOUR;
    const due = await inRequest(async () => {
      await installed("fails.myshopify.com", "old.myshopify.com");
      await probes.acquireLease("old.myshopify.com", now - 50 * HOUR, 1);
      await probes.release("old.myshopify.com", { succeeded: true, at: now - 50 * HOUR });
      await probes.acquireLease("fails.myshopify.com", now - HOUR, 1);
      await probes.release("fails.myshopify.com", { succeeded: false, at: now - HOUR, code: "transient", detail: "http_503" });
      return probes.listDue(now, COOLDOWN, 10);
    });
    expect(due).toEqual(["old.myshopify.com", "fails.myshopify.com"]);
  });
});

describe("ShopTokenProbeRepo leases", () => {
  it("gives the lease to exactly one of two concurrent claimants", async () => {
    const results = await inRequest(async () => {
      await installed("race.myshopify.com");
      return Promise.all([1, 2, 3, 4].map(() => probes.acquireLease("race.myshopify.com", 1_000, 60_000)));
    });
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses while the lease is live, takes over once it has expired, and frees it on release", async () => {
    const outcome = await inRequest(async () => {
      await installed("lease.myshopify.com");
      const first = await probes.acquireLease("lease.myshopify.com", 1_000, 60_000);
      const during = await probes.acquireLease("lease.myshopify.com", 30_000, 60_000);
      const afterExpiry = await probes.acquireLease("lease.myshopify.com", 61_000, 60_000);
      await probes.release("lease.myshopify.com", { succeeded: true, at: 62_000 });
      const afterRelease = await probes.acquireLease("lease.myshopify.com", 62_001, 60_000);
      return { first, during, afterExpiry, afterRelease };
    });
    expect(outcome).toEqual({ first: true, during: false, afterExpiry: true, afterRelease: true });
  });

  it("records success and failure without touching another shop's bookkeeping", async () => {
    await inRequest(async () => {
      await installed("one.myshopify.com", "two.myshopify.com");
      await probes.acquireLease("one.myshopify.com", 1_000, 60_000);
      await probes.acquireLease("two.myshopify.com", 1_000, 60_000);
      await probes.release("one.myshopify.com", { succeeded: false, at: 2_000, code: "transient", detail: "x".repeat(2_000) });
    });
    expect(await checkpoint("one.myshopify.com")).toMatchObject({ watermarkAt: null, lastFailedAt: 2_000, failureCode: "transient", lastSucceededAt: null });
    expect((await checkpoint("one.myshopify.com"))?.failureDetail).toHaveLength(1_000);
    expect(await checkpoint("two.myshopify.com")).toMatchObject({ watermarkAt: 61_000, lastFailedAt: null });
    await inRequest(() => probes.release("one.myshopify.com", { succeeded: true, at: 3_000 }));
    expect(await checkpoint("one.myshopify.com")).toMatchObject({ lastSucceededAt: 3_000, lastFailedAt: null, failureCode: null, failureDetail: null });
  });

  it("a release for a shop that was purged meanwhile creates nothing", async () => {
    await inRequest(async () => {
      await installed("purged.myshopify.com");
      await makeDb(env.DB).delete(shopifySyncCheckpoints);
      await makeDb(env.DB).delete(shops).where(eq(shops.shop, "purged.myshopify.com"));
      await probes.release("purged.myshopify.com", { succeeded: true, at: 5 });
    });
    expect(await checkpoint("purged.myshopify.com")).toBeUndefined();
  });
});
