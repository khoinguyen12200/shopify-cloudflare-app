import { describe, it, expect, vi, afterEach } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "~/models/shops.server";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { KVSessionStorage } from "~/session-storage.server";
import { consumeWebhook } from "~/services/webhook-consumer";
import { offlineSession, signedWebhookRequest } from "~/test/factories";
import { queuedDelivery } from "~/test/webhook-deliveries";
import { webhookConsumer } from "~/wiring.server";
import { action, loader } from "./compliance";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const WEBHOOK_URL = "https://example.test/webhooks/compliance";

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

function post(request: Request) {
  return inRequest(() =>
    action({
      request,
      params: {},
      url: new URL(request.url),
      pattern: "/webhooks/compliance",
      context: new RouterContextProvider(),
    }),
  );
}

const shopRow = (shop: string) => inRequest(() => new ShopRepo().get(shop));
const deliveryRow = (shop: string, id: string) => inRequest(() => new WebhookDeliveryRepo().get(shop, id));
const consume = (work: { shop: string; id: string }) => inRequest(() => consumeWebhook(webhookConsumer(), work));
const redact = (shop: string, webhookId: string) =>
  signedWebhookRequest({ url: WEBHOOK_URL, topic: "shop/redact", shop, payload: { shop_domain: shop }, webhookId });

describe("the compliance webhook endpoint", () => {
  it("rejects an invalid HMAC with 401 — never swallowed into a 200 — and records nothing", async () => {
    const shop = "bad-hmac.myshopify.com";
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL, topic: "customers/data_request", shop, payload: { customer: { id: 1 } }, badHmac: true, webhookId: "bad-hmac-1",
    });

    await expect(post(request)).rejects.toMatchObject({ status: 401 });
    expect(await deliveryRow(shop, "bad-hmac-1")).toBeUndefined();
  });

  it("acknowledges shop/redact only after it is durably queued, and does NOT purge inside the request", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "compliance-e2e.myshopify.com";
    await inRequest(() => new ShopRepo().recordInstall(shop, 1));

    const response = await post(await redact(shop, "redact-1"));

    expect(response.status).toBe(200);
    expect(await deliveryRow(shop, "redact-1")).toMatchObject({ topic: "shop/redact", status: "queued" });
    expect(await shopRow(shop)).toBeDefined();
  });

  it("purges when the queue consumer runs, and the row it was working from goes with the shop", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "compliance-purge.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    await post(await redact(shop, "redact-2"));

    await expect(consume({ shop, id: "redact-2" })).resolves.toEqual({ outcome: "processed", topic: "shop/redact" });

    expect(await shopRow(shop)).toBeUndefined();
    expect(await deliveryRow(shop, "redact-2")).toBeUndefined();
    expect(await inRequest(() => new KVSessionStorage(env.SESSION).findSessionsByShop(shop))).toEqual([]);
  });

  it("purges exactly once when the delivery arrives twice and the queue redelivers: a replay after the purge is a no-op", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "compliance-replay.myshopify.com";
    await inRequest(() => new ShopRepo().recordInstall(shop, 1));
    // Shopify retried the same delivery (same webhook id): both are acknowledged, only one is kept.
    expect((await post(await redact(shop, "redact-3"))).status).toBe(200);
    expect((await post(await redact(shop, "redact-3"))).status).toBe(200);

    await expect(consume({ shop, id: "redact-3" })).resolves.toMatchObject({ outcome: "processed" });
    // The shop installs again; the queue now redelivers the SAME message. It must not erase the new install.
    await inRequest(() => new ShopRepo().recordInstall(shop, 2));
    await expect(consume({ shop, id: "redact-3" })).resolves.toEqual({ outcome: "missing", topic: null });

    expect(await shopRow(shop)).toMatchObject({ currentInstalledAt: 2 });
  });

  it("purges only the redacted shop: another shop's rows, delivery and sessions survive", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const victim = "victim.myshopify.com";
    const bystander = "bystander.myshopify.com";
    await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(victim, 1);
      await repo.recordInstall(bystander, 1);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(bystander));
    });
    await inRequest(() => queuedDelivery({ shop: bystander, id: "bystander-delivery", topic: "app/uninstalled", triggeredAt: 5 }));
    await post(await redact(victim, "redact-4"));

    await consume({ shop: victim, id: "redact-4" });

    expect(await shopRow(victim)).toBeUndefined();
    expect(await shopRow(bystander)).toBeDefined();
    expect(await deliveryRow(bystander, "bystander-delivery")).toMatchObject({ status: "queued" });
    expect(await inRequest(() => new KVSessionStorage(env.SESSION).findSessionsByShop(bystander))).toHaveLength(1);
  });

  it("redacts a shop this app has no row for, because the delivery itself proves Shopify asked", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "no-row.myshopify.com";
    await post(await redact(shop, "redact-5"));
    await expect(consume({ shop, id: "redact-5" })).resolves.toEqual({ outcome: "processed", topic: "shop/redact" });
  });

  it.each(["customers/data_request", "customers/redact"] as const)("queues %s and the consumer answers it", async (topic) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "customers.myshopify.com";
    const id = `id-${topic}`;
    const response = await post(await signedWebhookRequest({ url: WEBHOOK_URL, topic, shop, payload: { customer: { id: 1 } }, webhookId: id }));
    expect(response.status).toBe(200);
    expect(await deliveryRow(shop, id)).toMatchObject({ topic, status: "queued" });
    await expect(consume({ shop, id })).resolves.toEqual({ outcome: "processed", topic });
    expect(await deliveryRow(shop, id)).toMatchObject({ status: "processed" });
  });

  it("keeps a non-2xx for a non-object payload and claims nothing, so Shopify's retry can land after a fix", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "malformed-payload.myshopify.com";
    const request = await signedWebhookRequest({ url: WEBHOOK_URL, topic: "shop/redact", shop, payload: "not-an-object", webhookId: "malformed-1" });

    const response = await post(request);
    expect(response.status).toBe(400);
    expect(await deliveryRow(shop, "malformed-1")).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining(shop));
  });

  it("acknowledges a topic it does not handle with 204 and queues nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "unknown-topic.myshopify.com";
    const response = await post(await signedWebhookRequest({ url: WEBHOOK_URL, topic: "orders/create", shop, payload: {}, webhookId: "unknown-1" }));
    expect(response.status).toBe(204);
    expect(await deliveryRow(shop, "unknown-1")).toBeUndefined();
  });

  it("rejects a GET with 405 rather than rendering an empty page", () => {
    const response = loader();
    expect(response.status).toBe(405);
  });
});
