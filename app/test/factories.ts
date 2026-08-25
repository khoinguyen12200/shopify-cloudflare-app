import { Session } from "@shopify/shopify-api";

/** An offline Shopify session, keyed the way `@shopify/shopify-api` expects. */
export function offlineSession(shop: string, overrides: Partial<Session> = {}): Session {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: "state",
    isOnline: false,
    accessToken: "token",
    scope: "write_products",
    ...overrides,
  });
}

async function hmacSha256Base64(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * A `Request` that `authenticate.webhook` will accept as genuinely from
 * Shopify — signed with the same secret the test env's Worker uses
 * (`SHOPIFY_API_SECRET` in `vitest.config.ts`), unless `badHmac` asks for a
 * deliberately wrong signature.
 */
export async function signedWebhookRequest({
  url,
  topic,
  shop,
  payload,
  secret = "test-api-secret",
  apiVersion = "2026-10",
  webhookId = "webhook-id-1",
  badHmac = false,
}: {
  url: string;
  topic: string;
  shop: string;
  payload: unknown;
  secret?: string;
  apiVersion?: string;
  webhookId?: string;
  badHmac?: boolean;
}): Promise<Request> {
  const body = JSON.stringify(payload);
  const hmac = badHmac
    ? "aW52YWxpZC1obWFj" // "invalid-hmac", base64 — well-formed but wrong
    : await hmacSha256Base64(secret, body);

  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": apiVersion,
      "X-Shopify-Webhook-Id": webhookId,
    },
    body,
  });
}
