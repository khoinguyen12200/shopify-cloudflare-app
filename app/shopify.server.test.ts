import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "~/models/shops.server";
import { afterAuth } from "./shopify.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

const SHOP = "dev-store-01.myshopify.com";

/** The shape the library hands the hook. Only `shop` is read. */
const authOf = (shop: string) => ({ session: { shop } });

/**
 * This app installs via token exchange, so `/auth/callback` never runs and
 * cannot be where an install is recorded. `afterAuth` is the only moment the
 * app is told a shop has a session — every row in `shops` starts here.
 */
describe("recording an install when a session is minted", () => {
  it("writes a shops row for the shop the session belongs to", async () => {
    const found = await inRequest(async () => {
      await afterAuth(authOf(SHOP));
      return new ShopRepo().get(SHOP);
    });

    expect(found).toMatchObject({ shop: SHOP, uninstalledAt: null });
  });

  it("makes the shop visible to the internal console's list", async () => {
    // The reported symptom: a store with a live session showing nowhere in
    // /internal/shops, because nothing had ever written its row.
    const listed = await inRequest(async () => {
      await afterAuth(authOf(SHOP));
      return new ShopRepo().listAll();
    });

    expect(listed.map((row) => row.shop)).toEqual([SHOP]);
  });

  it("leaves ONE row when a session is minted again", async () => {
    // Offline tokens expire, so the hook fires repeatedly over a shop's life.
    // Anything less than idempotent would multiply the shop on every renewal.
    const listed = await inRequest(async () => {
      await afterAuth(authOf(SHOP));
      await afterAuth(authOf(SHOP));
      await afterAuth(authOf(SHOP));
      return new ShopRepo().listAll();
    });

    expect(listed).toHaveLength(1);
  });

  it("revives a shop that had uninstalled, rather than leaving it uninstalled", async () => {
    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(SHOP, 1_000);
      await repo.recordUninstall(SHOP, 2_000);

      await afterAuth(authOf(SHOP));
      return repo.get(SHOP);
    });

    expect(found?.uninstalledAt).toBeNull();
  });

  it("keeps each shop's row separate", async () => {
    const other = "another-store.myshopify.com";

    const listed = await inRequest(async () => {
      await afterAuth(authOf(SHOP));
      await afterAuth(authOf(other));
      return new ShopRepo().listAll();
    });

    expect(listed.map((row) => row.shop).sort()).toEqual([other, SHOP].sort());
  });
});
