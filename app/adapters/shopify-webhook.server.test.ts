import { describe, expect, it } from "vitest";
import { signedWebhookRequest } from "~/test/factories";
import { verifyShopifyWebhook } from "./shopify-webhook.server";

const SECRET = "test-api-secret";
const URL_ = "https://app.test/webhooks/app/uninstalled";
const signed = (overrides: Partial<Parameters<typeof signedWebhookRequest>[0]> = {}) =>
  signedWebhookRequest({ url: URL_, topic: "app/uninstalled", shop: "shop-one.myshopify.com", payload: { id: 7 }, ...overrides });

async function rejection(promise: Promise<unknown>): Promise<number | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Response ? error.status : -1;
  }
}

describe("verifyShopifyWebhook", () => {
  it("accepts a correctly signed delivery and returns its identity and payload", async () => {
    const request = await signed({ webhookId: "wh-1" });
    request.headers.set("x-shopify-event-id", "ev-1");
    request.headers.set("x-shopify-triggered-at", "2026-10-08T11:43:30Z");
    await expect(verifyShopifyWebhook(request, SECRET)).resolves.toEqual({
      shop: "shop-one.myshopify.com", topic: "APP_UNINSTALLED", webhookId: "wh-1", eventId: "ev-1",
      apiVersion: "2026-10", triggeredAt: "2026-10-08T11:43:30Z", payload: { id: 7 },
    });
  });

  it("answers 401 for a wrong signature, a missing signature, a signature under another secret and a tampered body", async () => {
    expect(await rejection(verifyShopifyWebhook(await signed({ badHmac: true }), SECRET))).toBe(401);
    const missing = await signed();
    missing.headers.delete("x-shopify-hmac-sha256");
    expect(await rejection(verifyShopifyWebhook(missing, SECRET))).toBe(401);
    expect(await rejection(verifyShopifyWebhook(await signed({ secret: "someone-elses" }), SECRET))).toBe(401);
    const good = await signed();
    const tampered = new Request(URL_, { method: "POST", headers: good.headers, body: JSON.stringify({ id: 8 }) });
    expect(await rejection(verifyShopifyWebhook(tampered, SECRET))).toBe(401);
  });

  it("never accepts anything when the app secret is not configured", async () => {
    expect(await rejection(verifyShopifyWebhook(await signed(), ""))).toBe(401);
  });

  it("answers 401 for a signature that is not base64", async () => {
    const request = await signed();
    request.headers.set("x-shopify-hmac-sha256", "%%%not-base64%%%");
    expect(await rejection(verifyShopifyWebhook(request, SECRET))).toBe(401);
  });

  it("answers 405 for a non-POST request", async () => {
    expect(await rejection(verifyShopifyWebhook(new Request(URL_), SECRET))).toBe(405);
  });

  it("answers 400 for a validly signed delivery with a bad shop, missing header or non-JSON body", async () => {
    expect(await rejection(verifyShopifyWebhook(await signed({ shop: "evil.example.com" }), SECRET))).toBe(400);
    const noTopic = await signed();
    noTopic.headers.delete("x-shopify-topic");
    expect(await rejection(verifyShopifyWebhook(noTopic, SECRET))).toBe(400);
    const body = "not json";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hmac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))));
    const headers = new Headers(noTopic.headers);
    headers.set("x-shopify-topic", "app/uninstalled");
    headers.set("x-shopify-hmac-sha256", hmac);
    expect(await rejection(verifyShopifyWebhook(new Request(URL_, { method: "POST", headers, body }), SECRET))).toBe(400);
  });
});
