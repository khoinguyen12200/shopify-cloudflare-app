import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { KVSessionStorage } from "~/session-storage.server";
import { offlineSession, signedWebhookRequest } from "~/test/factories";
import { action } from "./uninstalled";

setupTestDatabase();

const WEBHOOK_URL = "https://example.test/webhooks/app/uninstalled";

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

function post(request: Request) {
  return inRequest(() =>
    action({
      request,
      params: {},
      url: new URL(request.url),
      pattern: "/webhooks/app/uninstalled",
      context: new RouterContextProvider(),
    }),
  );
}

describe("app/uninstalled webhook", () => {
  it("rejects an invalid HMAC with 401, not a swallowed success", async () => {
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app/uninstalled",
      shop: "bad-hmac.myshopify.com",
      payload: {},
      badHmac: true,
    });

    await expect(post(request)).rejects.toMatchObject({ status: 401 });
  });

  it("durably queues uninstall work even when the shop session exists", async () => {
    const shop = "uninstalled.myshopify.com";
    const storage = new KVSessionStorage(env.SESSION);
    await inRequest(async () => {
      await storage.storeSession(offlineSession(shop));
    });

    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app/uninstalled",
      shop,
      payload: {},
    });
    const response = await post(request);
    expect(response.status).toBe(200);

    const delivery = await inRequest(() => new WebhookDeliveryRepo().get(shop, "webhook-id-1"));
    expect(delivery?.status).toBe("queued");
  });

  it("is idempotent — a replayed delivery is a no-op, not an error", async () => {
    const shop = "replayed-uninstall.myshopify.com";
    await inRequest(async () => {
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });

    const request = () =>
      signedWebhookRequest({
        url: WEBHOOK_URL,
        topic: "app/uninstalled",
        shop,
        payload: {},
      });

    const first = await post(await request());
    expect(first.status).toBe(200);

    // Deliveries are at-least-once — the session is already gone by now.
    const second = await post(await request());
    expect(second.status).toBe(200);
  });
});
