import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "~/db/client";
import { shopGrantedScopes, shops, webhookDeliveries } from "~/db/schema";
import { shopHasher } from "~/adapters/shop-hasher";
import { RedactedShopRepo } from "~/models/redacted-shops.server";
import { ShopRepo } from "~/models/shops.server";
import { WebhookScopeObservationRepo } from "~/models/webhook-scope-observations.server";
import { runWithRequestContext } from "~/request-context.server";
import { KVSessionStorage } from "~/session-storage.server";
import { setupTestDatabase } from "~/test/db";
import { offlineSession } from "~/test/factories";
import { queuedDelivery } from "~/test/webhook-deliveries";
import { webhookConsumer } from "~/wiring.server";
import { consumeWebhook } from "./webhook-consumer";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const db = () => makeDb(env.DB);
const consume = (work: { shop: string; id: string; attempts?: number }) => inRequest(() => consumeWebhook(webhookConsumer(), work));
const row = (shop: string) => inRequest(() => new ShopRepo().get(shop));
const sessionsOf = (shop: string) => inRequest(() => new KVSessionStorage(env.SESSION).findSessionsByShop(shop));

const deliveryStatuses = async (shop: string) =>
  (await db().select({ id: webhookDeliveries.id, status: webhookDeliveries.status }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)));
const tombstone = (shop: string) => inRequest(async () => new RedactedShopRepo().mark(await shopHasher.hash(shop), 1));

function quiet() {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("app/uninstalled ordering (real D1 + KV)", () => {
  it("an uninstall delivered AFTER a reinstall leaves the shop installed and its sessions in place", async () => {
    quiet();
    const shop = "reinstalled.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 5_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    const work = await inRequest(() => queuedDelivery({ shop, id: "late-uninstall", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toEqual({ outcome: "processed", topic: "app/uninstalled" });

    expect(await row(shop)).toMatchObject({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 5_000, uninstalledAt: null, currentInstalledAt: 5_000 });
    expect(await sessionsOf(shop)).toHaveLength(1);
  });

  it("an in-order uninstall records the delivery's trigger time (not the clock) and deletes the sessions", async () => {
    quiet();
    const shop = "in-order.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    const work = await inRequest(() => queuedDelivery({ shop, id: "in-order", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await consume(work);

    expect(await row(shop)).toMatchObject({
      relationshipStatus: "UNINSTALLED", uninstalledAt: 2_000, relationshipOccurredAt: 2_000, relationshipExternalId: "webhook:in-order", currentInstalledAt: null,
    });
    expect(await sessionsOf(shop)).toHaveLength(0);
  });

  it("a duplicate delivery has exactly one effect: the replay neither re-records nor re-cleans", async () => {
    quiet();
    const shop = "duplicate.myshopify.com";
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1_000); });
    const work = await inRequest(() => queuedDelivery({ shop, id: "dup", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toMatchObject({ outcome: "processed" });
    const afterFirst = await row(shop);
    // The shop reinstalls between the first run and the queue redelivering the same message.
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 9_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    await expect(consume(work)).resolves.toMatchObject({ outcome: "duplicate" });

    expect(afterFirst).toMatchObject({ relationshipStatus: "UNINSTALLED", uninstalledAt: 2_000 });
    expect(await row(shop)).toMatchObject({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 9_000 });
    expect(await sessionsOf(shop)).toHaveLength(1);
  });

  it("an uninstall never touches another shop", async () => {
    quiet();
    await inRequest(async () => {
      await new ShopRepo().recordInstall("victim.myshopify.com", 1_000);
      await new ShopRepo().recordInstall("bystander.myshopify.com", 1_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession("bystander.myshopify.com"));
    });
    const work = await inRequest(() => queuedDelivery({ shop: "victim.myshopify.com", id: "victim", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await consume(work);

    expect(await row("bystander.myshopify.com")).toMatchObject({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 1_000 });
    expect(await sessionsOf("bystander.myshopify.com")).toHaveLength(1);
  });

  it("applyUninstall itself refuses to overwrite a newer install, even when the caller's read was stale", async () => {
    const shop = "race.myshopify.com";
    const written = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 8_000);
      return repo.applyUninstall(shop, { kind: "uninstalled", occurredAt: 3_000, externalId: "webhook:old" });
    });
    expect(written).toBe("stale");
    expect(await row(shop)).toMatchObject({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 8_000 });
  });
});

describe("app/scopes_update ordering (real D1 + KV)", () => {
  async function scopesUpdate(shop: string, id: string, triggeredAt: number, scopes: readonly string[]) {
    return inRequest(async () => {
      const work = await queuedDelivery({ shop, id, topic: "app/scopes_update", triggeredAt });
      await new WebhookScopeObservationRepo().record(id, shop, scopes);
      return work;
    });
  }
  const granted = async (shop: string) => (await db().select({ scope: shopGrantedScopes.scope }).from(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)).orderBy(shopGrantedScopes.scope)).map((r) => r.scope);

  it("applies deliveries in trigger order even when the OLDER one is processed last", async () => {
    quiet();
    const shop = "scopes.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop, { scope: "initial" }));
    });
    const newer = await scopesUpdate(shop, "scopes-newer", 3_000, ["read_orders", "read_products"]);
    const older = await scopesUpdate(shop, "scopes-older", 2_000, ["read_products"]);

    await consume(newer);
    await consume(older);

    expect(await granted(shop)).toEqual(["read_orders", "read_products"]);
    expect((await sessionsOf(shop))[0]?.scope).toBe("read_orders,read_products");
  });

  it("records the change at the trigger time so later deliveries are compared with it", async () => {
    quiet();
    const shop = "scopes-time.myshopify.com";
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1); });
    await consume(await scopesUpdate(shop, "scopes-t", 4_000, ["read_products"]));
    expect(await inRequest(() => new WebhookScopeObservationRepo().latestChangeAt(shop))).toBe(4_000);
    expect(await inRequest(() => new WebhookScopeObservationRepo().latestChangeAt("someone-else.myshopify.com"))).toBeNull();
  });

  it("a replay of the same delivery changes nothing", async () => {
    quiet();
    const shop = "scopes-dup.myshopify.com";
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1); });
    const work = await scopesUpdate(shop, "scopes-dup", 2_000, ["read_products"]);
    await consume(work);
    await expect(consume(work)).resolves.toMatchObject({ outcome: "duplicate" });
    expect(await granted(shop)).toEqual(["read_products"]);
    const deliveries = await db().select({ status: webhookDeliveries.status }).from(webhookDeliveries).where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, "scopes-dup")));
    expect(deliveries).toEqual([{ status: "processed" }]);
  });

  it("does not resurrect rows for a redacted shop, and leaves no delivery row naming it", async () => {
    quiet();
    const shop = "tombstoned-scopes.myshopify.com";
    await tombstone(shop);
    const work = await scopesUpdate(shop, "scopes-ghost", 2_000, ["read_products"]);
    await expect(consume(work)).resolves.toEqual({ outcome: "missing", topic: "app/scopes_update" });
    expect(await granted(shop)).toEqual([]);
    expect(await db().select().from(shops).where(eq(shops.shop, shop))).toEqual([]);
    expect(await deliveryStatuses(shop)).toEqual([]);
  });

  it("an unknown (never tombstoned) shop's scopes_update is deferred, not dropped, while retries remain", async () => {
    quiet();
    const shop = "early-scopes.myshopify.com";
    const work = await scopesUpdate(shop, "early-1", 2_000, ["read_products"]);
    await expect(consume({ ...work, attempts: 1 })).resolves.toMatchObject({ outcome: "deferred", topic: "app/scopes_update" });
    expect(await deliveryStatuses(shop)).toEqual([{ id: "early-1", status: "queued" }]);

    // The first embedded load writes the row; the redelivery now applies the update.
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1_000); });
    await expect(consume({ ...work, attempts: 2 })).resolves.toMatchObject({ outcome: "processed" });
    expect(await granted(shop)).toEqual(["read_products"]);
    expect(await deliveryStatuses(shop)).toEqual([{ id: "early-1", status: "processed" }]);
  });

  it("on the final attempt an unknown shop's scopes_update settles as a logged no-op and keeps its delivery row", async () => {
    quiet();
    const shop = "never-installed.myshopify.com";
    const work = await scopesUpdate(shop, "final-1", 2_000, ["read_products"]);
    await expect(consume({ ...work, attempts: 9 })).resolves.toMatchObject({ outcome: "processed" });
    expect(await granted(shop)).toEqual([]);
    expect(await db().select().from(shops).where(eq(shops.shop, shop))).toEqual([]);
    expect(await deliveryStatuses(shop)).toEqual([{ id: "final-1", status: "processed" }]);
  });
});

describe("a shop with no shops row is not a redacted shop (real D1)", () => {
  it("app/uninstalled for an unknown shop is a logged no-op: processed, row kept, no shop created", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shop = "unknown-uninstall.myshopify.com";
    const work = await inRequest(() => queuedDelivery({ shop, id: "unknown-1", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toEqual({ outcome: "processed", topic: "app/uninstalled" });

    expect(await deliveryStatuses(shop)).toEqual([{ id: "unknown-1", status: "processed" }]);
    expect(await row(shop)).toBeUndefined();
    const events = log.mock.calls.map(([line]) => String(line));
    expect(events.some((line) => line.includes('"event":"webhook.shop_unknown"') && !line.includes(shop))).toBe(true);
  });

  it("a duplicate delivery for an unknown shop has exactly one effect", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shop = "unknown-dup.myshopify.com";
    const work = await inRequest(() => queuedDelivery({ shop, id: "unknown-dup", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toMatchObject({ outcome: "processed" });
    await expect(consume(work)).resolves.toMatchObject({ outcome: "duplicate" });

    const unknownLogs = log.mock.calls.filter(([line]) => String(line).includes('"event":"webhook.shop_unknown"'));
    expect(unknownLogs).toHaveLength(1);
    expect(await deliveryStatuses(shop)).toEqual([{ id: "unknown-dup", status: "processed" }]);
  });

  it("a tombstoned shop's uninstall is discarded and its delivery row deleted", async () => {
    quiet();
    const shop = "tombstoned-uninstall.myshopify.com";
    await tombstone(shop);
    const work = await inRequest(() => queuedDelivery({ shop, id: "tomb-1", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toEqual({ outcome: "missing", topic: "app/uninstalled" });

    expect(await deliveryStatuses(shop)).toEqual([]);
    expect(await row(shop)).toBeUndefined();
  });

  it("a known shop's uninstall runs normally and logs no unknown-shop event", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shop = "known-uninstall.myshopify.com";
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1_000); });
    const work = await inRequest(() => queuedDelivery({ shop, id: "known-1", topic: "app/uninstalled", triggeredAt: 2_000 }));

    await expect(consume(work)).resolves.toMatchObject({ outcome: "processed" });

    expect(await row(shop)).toMatchObject({ relationshipStatus: "UNINSTALLED" });
    expect(log.mock.calls.some(([line]) => String(line).includes("webhook.shop_unknown"))).toBe(false);
  });
});
