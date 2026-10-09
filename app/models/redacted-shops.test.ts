import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import { shopHasher } from "~/adapters/shop-hasher";
import { redactedShops } from "~/db/schema";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { RedactedShopRepo } from "./redacted-shops.server";

setupTestDatabase();
const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

describe("RedactedShopRepo (real D1)", () => {
  it("marks idempotently, keeping the first timestamp", async () => {
    await inRequest(async () => {
      const repo = new RedactedShopRepo();
      await repo.mark("hash-idem", 100);
      await repo.mark("hash-idem", 999);
      expect(await repo.isRedacted("hash-idem")).toBe(true);
    });
    const rows = await drizzle(env.DB).select().from(redactedShops);
    expect(rows.filter((row) => row.shopHash === "hash-idem")).toEqual([{ shopHash: "hash-idem", redactedAt: 100 }]);
  });

  it("clears a tombstone and reports whether one existed", async () => {
    await inRequest(async () => {
      const repo = new RedactedShopRepo();
      await repo.mark("hash-clear", 1);
      expect(await repo.clear("hash-clear")).toBe(true);
      expect(await repo.isRedacted("hash-clear")).toBe(false);
      expect(await repo.clear("hash-clear")).toBe(false);
    });
  });

  it("marking one shop does not suppress another, and findRedacted is one exact-match query", async () => {
    await inRequest(async () => {
      const repo = new RedactedShopRepo();
      const [a, b] = await Promise.all([shopHasher.hash("iso-a.myshopify.com"), shopHasher.hash("iso-b.myshopify.com")]);
      await repo.mark(a, 1);
      expect(await repo.isRedacted(a)).toBe(true);
      expect(await repo.isRedacted(b)).toBe(false);
      expect([...(await repo.findRedacted([a, b]))]).toEqual([a]);
      expect((await repo.findRedacted([])).size).toBe(0);
    });
  });

  it("stores a hash, never the domain", async () => {
    const hash = await shopHasher.hash("Plain.myshopify.com");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(await shopHasher.hash("plain.myshopify.com"));
    expect(hash).not.toContain("plain");
  });
});
