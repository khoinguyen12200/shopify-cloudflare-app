export type VerifiedWebhook = Readonly<{
  shop: string;
  /** Upper-snake form, e.g. `APP_UNINSTALLED`. */
  topic: string;
  webhookId: string;
  eventId: string | null;
  apiVersion: string;
  triggeredAt: string | null;
  payload: unknown;
}>;

/** Same normalisation the Shopify library applies ("shop/redact" -> "SHOP_REDACT"); consumers are keyed on it. */
function topicForStorage(topic: string): string {
  return topic.toUpperCase().replace(/[/.]/g, "_");
}

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-_]*\.myshopify\.com$/;

/**
 * Verify that a request really is a Shopify webhook delivery, and read it.
 *
 * Deliberately NOT `shopify.authenticate.webhook`: that also loads the shop's offline session and, when its access
 * token is within five minutes of expiry, refreshes it with Shopify. Offline tokens last an hour, and once the app is
 * uninstalled Shopify rejects the refresh — so the library answers `app/uninstalled` and the GDPR redactions with a
 * bare 500, exactly when they must succeed. A webhook is authenticated by its HMAC alone; none of these handlers call
 * the Admin API, so no session is needed.
 *
 * Answers with a thrown `Response`, like the library: 405 non-POST, 401 missing/invalid signature, 400 malformed.
 */
export async function verifyShopifyWebhook(request: Request, secret: string): Promise<VerifiedWebhook> {
  if (request.method !== "POST") throw new Response(undefined, { status: 405, statusText: "Method not allowed" });
  const body = await request.arrayBuffer();
  if (!(await hasValidSignature(request.headers.get("x-shopify-hmac-sha256"), body, secret))) {
    throw new Response(undefined, { status: 401, statusText: "Unauthorized" });
  }
  const shop = request.headers.get("x-shopify-shop-domain") ?? "";
  const topic = request.headers.get("x-shopify-topic");
  const webhookId = request.headers.get("x-shopify-webhook-id");
  const apiVersion = request.headers.get("x-shopify-api-version");
  if (!SHOP_DOMAIN.test(shop) || !topic || !webhookId || !apiVersion) {
    throw new Response(undefined, { status: 400, statusText: "Bad Request" });
  }
  const payload = parseJson(new TextDecoder().decode(body));
  if (payload === undefined) throw new Response(undefined, { status: 400, statusText: "Bad Request" });
  return {
    shop,
    topic: topicForStorage(topic),
    webhookId,
    eventId: request.headers.get("x-shopify-event-id"),
    apiVersion,
    triggeredAt: request.headers.get("x-shopify-triggered-at"),
    payload,
  };
}

async function hasValidSignature(header: string | null, body: ArrayBuffer, secret: string): Promise<boolean> {
  if (header === null || secret === "") return false;
  const signature = decodeBase64(header);
  if (signature === null) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // `verify` compares in constant time, so a forged signature cannot be recovered byte by byte.
  return crypto.subtle.verify("HMAC", key, signature, body);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}
