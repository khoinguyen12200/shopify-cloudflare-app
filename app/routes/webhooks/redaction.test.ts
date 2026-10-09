import { env } from "cloudflare:test";
import { count, eq } from "drizzle-orm";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shopHasher } from "~/adapters/shop-hasher";
import { makeDb } from "~/db/client";
import { webhookDeliveries } from "~/db/schema";
import { RedactedShopRepo } from "~/models/redacted-shops.server";
import { ShopRepo } from "~/models/shops.server";
import { runWithRequestContext } from "~/request-context.server";
import { afterAuth } from "~/shopify.server";
import { consumeWebhook } from "~/services/webhook-consumer";
import { setupTestDatabase } from "~/test/db";
import { signedWebhookRequest } from "~/test/factories";
import { queuedDelivery } from "~/test/webhook-deliveries";
import { webhookConsumer } from "~/wiring.server";
import { action as complianceAction } from "./compliance";
import { action as uninstalledAction } from "./app/uninstalled";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
type Action = typeof complianceAction;
const post = (handler: Action, request: Request) => inRequest(() => handler({ request, params: {}, url: new URL(request.url), pattern: "/", context: new RouterContextProvider() }));
const redact = (shop: string, webhookId: string) => signedWebhookRequest({ url: "https://example.test/webhooks/compliance", topic: "shop/redact", shop, payload: { shop_domain: shop }, webhookId });
const uninstall = (shop: string, webhookId: string) => signedWebhookRequest({ url: "https://example.test/webhooks/app/uninstalled", topic: "app/uninstalled", shop, payload: { id: 1 }, webhookId });
const consume = (work: { shop: string; id: string }) => inRequest(() => consumeWebhook(webhookConsumer(), work));
const deliveryCount = async (shop: string) => Number((await makeDb(env.DB).select({ count: count() }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)).get())?.count ?? 0);
const isTombstoned = (shop: string) => inRequest(async () => new RedactedShopRepo().isRedacted(await shopHasher.hash(shop)));

async function redactAndPurge(shop: string, id: string) {
  await inRequest(() => new ShopRepo().recordInstall(shop, 1));
  await post(complianceAction, await redact(shop, id));
  await consume({ shop, id });
}

describe("redaction tombstone at webhook intake (real D1 + queue)", () => {
  it("a purge leaves a tombstone and no delivery row", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-intake-1.myshopify.com";
    await redactAndPurge(shop, "tomb-r1");
    expect(await isTombstoned(shop)).toBe(true);
    expect(await deliveryCount(shop)).toBe(0);
    expect(log.mock.calls.map(String).join("\n")).not.toContain(shop);
  });

  it("acknowledges a late app/uninstalled for a redacted shop with 2xx and stores nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-intake-2.myshopify.com";
    await redactAndPurge(shop, "tomb-r2");

    const response = await post(uninstalledAction, await uninstall(shop, "late-uninstall"));

    expect(response.status).toBe(200);
    expect(await deliveryCount(shop)).toBe(0);
  });

  it("a duplicate or later shop/redact is acknowledged, is a no-op with exactly one purge effect, and leaves no row", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-intake-3.myshopify.com";
    await redactAndPurge(shop, "tomb-r3");

    expect((await post(complianceAction, await redact(shop, "tomb-r3"))).status).toBe(200);
    expect((await post(complianceAction, await redact(shop, "tomb-r3-again"))).status).toBe(200);

    expect(await deliveryCount(shop)).toBe(0);
    const handled = log.mock.calls.map(String).filter((line) => line.includes('"event":"compliance.handled"'));
    expect(handled).toHaveLength(1);
    expect(await isTombstoned(shop)).toBe(true);
  });

  it("does not suppress another shop", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await redactAndPurge("tomb-intake-4.myshopify.com", "tomb-r4");
    const other = "tomb-bystander.myshopify.com";
    expect((await post(uninstalledAction, await uninstall(other, "bystander-uninstall"))).status).toBe(200);
    expect(await deliveryCount(other)).toBe(1);
  });

  it("a genuine reinstall clears the tombstone and the shop's webhooks flow again", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-intake-5.myshopify.com";
    await redactAndPurge(shop, "tomb-r5");

    await inRequest(() => afterAuth({ session: { shop } }, async () => undefined));

    expect(await isTombstoned(shop)).toBe(false);
    await post(uninstalledAction, await uninstall(shop, "after-reinstall"));
    expect(await deliveryCount(shop)).toBe(1);
  });

  it("the consumer deletes a delivery it skips for a redacted shop, so nothing lingers", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-skip.myshopify.com"; // no shops row: the consumer treats the shop as redacted
    const work = await inRequest(() => queuedDelivery({ shop, id: "skip-me", topic: "app/uninstalled", triggeredAt: 5 }));
    expect(await deliveryCount(shop)).toBe(1);

    await expect(consume(work)).resolves.toEqual({ outcome: "missing", topic: "app/uninstalled" });

    expect(await deliveryCount(shop)).toBe(0);
  });
});
