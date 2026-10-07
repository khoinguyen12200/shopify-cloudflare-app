import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { PlanGrantsRepo } from "./plan-grants.server";
import { ShopRepo } from "./shops.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

describe("PlanGrantsRepo persistence", () => {
  const shopRepo = new ShopRepo();
  const repo = new PlanGrantsRepo();

  async function ensureShop(shop = "test-store.myshopify.com") {
    const existing = await shopRepo.get(shop);
    if (existing) return existing;
    await shopRepo.recordInstall(shop, Date.now());
    return (await shopRepo.get(shop))!;
  }

  it("creates, finds, and lists active grants for a shop", async () => {
    await inRequest(async () => {
      const shopDomain = "promo-test.myshopify.com";
      await ensureShop(shopDomain);
      const now = Date.now();

      const grant = await repo.createGrant({
        id: "grant-1",
        shop: shopDomain,
        planHandle: "pro",
        reason: "Customer support compensation",
        grantedBy: "staff@example.com",
        startsAt: now - 1000,
        expiresAt: now + 10 * 86_400_000,
        createdAt: now,
      });

      expect(grant.id).toBe("grant-1");
      expect(grant.planHandle).toBe("pro");

      const active = await repo.findActiveGrant(shopDomain, now);
      expect(active).toBeDefined();
      expect(active?.id).toBe("grant-1");

      const all = await repo.listGrantsForShop(shopDomain);
      expect(all.length).toBe(1);
      expect(all[0]?.id).toBe("grant-1");

      const activeCount = await repo.countActiveGrants(now);
      expect(activeCount).toBeGreaterThanOrEqual(1);
    });
  });

  it("revokes an active grant and ensures it is no longer returned as active", async () => {
    await inRequest(async () => {
      const shopDomain = "revoke-test.myshopify.com";
      await ensureShop(shopDomain);
      const now = Date.now();

      await repo.createGrant({
        id: "grant-to-revoke",
        shop: shopDomain,
        planHandle: "pro",
        reason: "Trial",
        grantedBy: "staff@example.com",
        startsAt: now - 1000,
        expiresAt: now + 10 * 86_400_000,
        createdAt: now,
      });

      const revoked = await repo.revokeGrant(shopDomain, "grant-to-revoke", "admin@example.com", now);
      expect(revoked).toBe(true);

      const active = await repo.findActiveGrant(shopDomain, now);
      expect(active).toBeNull();

      const all = await repo.listGrantsForShop(shopDomain);
      expect(all[0]?.revokedAt).toBe(now);
      expect(all[0]?.revokedBy).toBe("admin@example.com");
    });
  });

  it("ignores expired grants when finding active grant", async () => {
    await inRequest(async () => {
      const shopDomain = "expired-test.myshopify.com";
      await ensureShop(shopDomain);
      const now = Date.now();

      await repo.createGrant({
        id: "grant-expired",
        shop: shopDomain,
        planHandle: "pro",
        reason: "Past trial",
        grantedBy: "staff@example.com",
        startsAt: now - 20 * 86_400_000,
        expiresAt: now - 1000,
        createdAt: now - 20 * 86_400_000,
      });

      const active = await repo.findActiveGrant(shopDomain, now);
      expect(active).toBeNull();
    });
  });
});
