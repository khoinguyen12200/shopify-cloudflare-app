import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { KVSessionStorage } from "~/session-storage.server";
import { offlineSession, signedWebhookRequest } from "~/test/factories";
import { action } from "./scopes-update";

const WEBHOOK_URL = "https://example.test/webhooks/app/scopes_update";

function post(request: Request) {
  return runWithRequestContext(env, () =>
    action({
      request,
      params: {},
      url: new URL(request.url),
      pattern: "/webhooks/app/scopes_update",
      context: new RouterContextProvider(),
    }),
  );
}

describe("app/scopes_update webhook", () => {
  it("rejects an invalid HMAC with 401, not a swallowed success", async () => {
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app/scopes_update",
      shop: "bad-hmac.myshopify.com",
      payload: { current: ["read_products"] },
      badHmac: true,
    });

    await expect(post(request)).rejects.toMatchObject({ status: 401 });
  });

  it("updates the stored session's scope from the payload's current list", async () => {
    const shop = "scopes-update.myshopify.com";
    const storage = new KVSessionStorage(env.SESSION);
    await storage.storeSession(offlineSession(shop, { scope: "read_products" }));

    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app/scopes_update",
      shop,
      payload: { current: ["read_products", "write_products"] },
    });

    const response = await post(request);
    expect(response.status).toBe(200);

    const stored = await storage.loadSession(`offline_${shop}`);
    expect(stored?.scope).toBe("read_products,write_products");
  });

  it("leaves the stored session untouched when the payload is malformed", async () => {
    const shop = "malformed-scopes.myshopify.com";
    const storage = new KVSessionStorage(env.SESSION);
    await storage.storeSession(offlineSession(shop, { scope: "read_products" }));

    // `current` missing entirely — a shape authenticate.webhook would never
    // reject (it only checks the HMAC), so the route itself must guard it.
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "app/scopes_update",
      shop,
      payload: { updated_at: "2024-10-01T00:00:00.000Z" },
    });

    const response = await post(request);
    expect(response.status).toBe(200);

    const stored = await storage.loadSession(`offline_${shop}`);
    expect(stored?.scope).toBe("read_products");
  });
});
