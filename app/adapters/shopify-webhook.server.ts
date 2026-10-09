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
 * The secrets a delivery may be signed with: the current client secret first, then the previous one while a rotation
 * is in flight. Shopify documents that after a client-secret rotation "it can take up to an hour" for the webhook
 * HMAC to start using the new secret (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), so a verifier
 * that knows only the new secret rejects genuine deliveries during that window — and a 401 is a failed delivery.
 *
 * `SHOPIFY_API_SECRET_PREVIOUS` is deliberately absent from `wrangler.jsonc` `secrets.required` (wrangler 4.125
 * has no `optional` list, and a required secret blocks the deploy until it is set), so it is not in the generated
 * `Env`; the parameter type names it as an optional `unknown` and it is narrowed with `typeof`. Set it only for the rotation window and remove it afterwards: a
 * revoked secret that stays accepted is a standing forgery risk. Empty values are dropped, never matched.
 */
export function webhookSecrets(env: { readonly SHOPIFY_API_SECRET: string; readonly SHOPIFY_API_SECRET_PREVIOUS?: unknown }): readonly string[] {
  const previous = typeof env.SHOPIFY_API_SECRET_PREVIOUS === "string" ? env.SHOPIFY_API_SECRET_PREVIOUS : "";
  return [env.SHOPIFY_API_SECRET, previous].filter((secret) => secret !== "");
}

/**
 * Verify that a request really is a Shopify webhook delivery, and read it.
 *
 * Deliberately NOT `shopify.authenticate.webhook`: that also loads the shop's offline session and, when its access
 * token is within five minutes of expiry, refreshes it with Shopify. Offline tokens last an hour, and once the app is
 * uninstalled Shopify rejects the refresh — so the library answers `app/uninstalled` and the GDPR redactions with a
 * bare 500, exactly when they must succeed. A webhook is authenticated by its HMAC alone; none of these handlers call
 * the Admin API, so no session is needed.
 *
 * `secrets` is an ordered list (`webhookSecrets`); a delivery is genuine if ANY non-empty entry signs it.
 *
 * Answers with a thrown `Response`, like the library: 405 non-POST, 401 missing/invalid signature, 400 malformed.
 */
export async function verifyShopifyWebhook(request: Request, secrets: readonly string[]): Promise<VerifiedWebhook> {
  if (request.method !== "POST") throw new Response(undefined, { status: 405, statusText: "Method not allowed" });
  const body = await request.arrayBuffer();
  if (!(await hasValidSignature(request.headers.get("x-shopify-hmac-sha256"), body, secrets))) {
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

async function hasValidSignature(header: string | null, body: ArrayBuffer, secrets: readonly string[]): Promise<boolean> {
  if (header === null) return false;
  const signature = decodeBase64(header);
  if (signature === null) return false;
  for (const secret of secrets) {
    if (secret === "") continue;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    // `verify` compares in constant time, so a forged signature cannot be recovered byte by byte.
    if (await crypto.subtle.verify("HMAC", key, signature, body)) return true;
  }
  return false;
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
