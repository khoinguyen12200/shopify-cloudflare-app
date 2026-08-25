import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { signedWebhookRequest } from "~/test/factories";
import { action } from "./subscriptions-update";

setupTestDatabase();

const WEBHOOK_URL = "https://example.test/webhooks/app/subscriptions_update";

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

function post(request: Request) {
  return inRequest(() =>
    action({
      request,
      params: {},
      url: new URL(request.url),
      pattern: "/webhooks/app/subscriptions_update",
      context: new RouterContextProvider(),
    }),
  );
}

function subscriptionPayload(overrides: Record<string, unknown> = {}) {
  return {
    app_subscription: {
      admin_graphql_api_id: "gid://shopify/AppSubscription/1",
      name: "TODO:PRO",
      status: "ACTIVE",
      admin_graphql_api_shop_id: "gid://shopify/Shop/1",
      created_at: "2024-06-25T00:00:00.000Z",
      updated_at: "2024-06-25T00:00:00.000Z",
      currency: "USD",
      price: "19.00",
      interval: "every_30_days",
      plan_handle: "todo-pro",
      ...overrides,
    },
  };
}

describe("app/subscriptions_update webhook", () => {
  it("rejects an invalid HMAC with 401, not a swallowed success", async () => {
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app_subscriptions/update",
      shop: "bad-hmac.myshopify.com",
      payload: subscriptionPayload(),
      badHmac: true,
    });

    await expect(post(request)).rejects.toMatchObject({ status: 401 });
  });

  it("records the subscription event for the shop", async () => {
    const shop = "subscribed.myshopify.com";
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app_subscriptions/update",
      shop,
      payload: subscriptionPayload(),
    });

    const response = await post(request);
    expect(response.status).toBe(200);

    const history = await inRequest(() => new SubscriptionEventRepo().listForShop(shop));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      shop,
      status: "ACTIVE",
      priceAmount: 1900,
      priceCurrency: "USD",
    });
  });

  it("is idempotent — a replayed delivery does not duplicate the history", async () => {
    const shop = "replayed-sub.myshopify.com";
    const request = () =>
      signedWebhookRequest({
        url: WEBHOOK_URL,
        topic: "app_subscriptions/update",
        shop,
        payload: subscriptionPayload(),
      });

    const first = await post(await request());
    expect(first.status).toBe(200);
    const second = await post(await request());
    expect(second.status).toBe(200);

    const history = await inRequest(() => new SubscriptionEventRepo().listForShop(shop));
    expect(history).toHaveLength(1);
  });

  it("returns 400 for a malformed payload rather than a 500 or a swallowed 200", async () => {
    const shop = "malformed.myshopify.com";
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app_subscriptions/update",
      shop,
      payload: { app_subscription: { status: "NOT_A_REAL_STATUS" } },
    });

    const response = await post(request);
    expect(response.status).toBe(400);

    const history = await inRequest(() => new SubscriptionEventRepo().listForShop(shop));
    expect(history).toHaveLength(0);
  });
});
