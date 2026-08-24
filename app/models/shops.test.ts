import { describe, it, expect } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "./shops.server";

setupTestDatabase();

/** Model code reads its DB handle from the request context, so tests provide one. */
function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

describe("ShopRepo", () => {
  it("returns undefined for a shop it has never seen", async () => {
    const found = await inRequest(() => new ShopRepo().get("nope.myshopify.com"));
    expect(found).toBeUndefined();
  });

  it("records an install", async () => {
    const shop = "install.myshopify.com";
    const now = 1_700_000_000_000;

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, now);
      return repo.get(shop);
    });

    expect(found).toMatchObject({ shop, installedAt: now, uninstalledAt: null });
  });

  it("is idempotent across a repeated install", async () => {
    const shop = "repeat.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordInstall(shop, 2);
      return repo.get(shop);
    });

    // The original install time is preserved; the row is revived, not replaced.
    expect(found?.installedAt).toBe(1);
  });

  it("clears uninstalledAt when a shop reinstalls", async () => {
    const shop = "reinstall.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordUninstall(shop, 2);
      await repo.recordInstall(shop, 3);
      return repo.get(shop);
    });

    expect(found?.uninstalledAt).toBeNull();
  });

  it("records an uninstall", async () => {
    const shop = "gone.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordUninstall(shop, 99);
      return repo.get(shop);
    });

    expect(found?.uninstalledAt).toBe(99);
  });
});
