import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "~/models/shops.server";
import { signedWebhookRequest } from "~/test/factories";
import { action, loader } from "./compliance";

setupTestDatabase();

const WEBHOOK_URL = "https://example.test/webhooks/compliance";

function post(request: Request) {
  return runWithRequestContext(env, () =>
    action({
      request,
      params: {},
      url: new URL(request.url),
      pattern: "/webhooks/compliance",
      context: new RouterContextProvider(),
    }),
  );
}

describe("the compliance webhook endpoint", () => {
  it("rejects an invalid HMAC with 401 — never swallowed into a 200", async () => {
    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "customers/data_request",
      shop: "bad-hmac.myshopify.com",
      payload: { customer: { id: 1 } },
      badHmac: true,
    });

    await expect(post(request)).rejects.toMatchObject({ status: 401 });
  });

  it("acknowledges a genuine shop/redact delivery with 200 and does the work", async () => {
    const shop = "compliance-e2e.myshopify.com";
    await runWithRequestContext(env, () => new ShopRepo().recordInstall(shop, 1));

    const request = await signedWebhookRequest({
      url: WEBHOOK_URL,
      topic: "shop/redact",
      shop,
      payload: { shop_domain: shop },
    });

    const response = await post(request);
    expect(response.status).toBe(200);

    const record = await runWithRequestContext(env, () => new ShopRepo().get(shop));
    expect(record).toBeUndefined();
  });

  it("rejects a GET with 405 rather than rendering an empty page", () => {
    const response = loader();
    expect(response.status).toBe(405);
  });
});
