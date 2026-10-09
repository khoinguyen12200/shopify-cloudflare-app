import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { KVSessionStorage } from "~/session-storage.server";
import { offlineSession } from "~/test/factories";
import { ShopifyTokenRefresh } from "./shopify-token-refresh.server";

const SHOP = "refresh.myshopify.com";
const NOW = 1_800_000_000_000;
const EXPIRED = new Date(NOW - 60_000);

const store = () => new KVSessionStorage(env.SESSION);
const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const GOOD = { access_token: "shpat_new", expires_in: 3600, refresh_token: "shprt_new", refresh_token_expires_in: 7_776_000, scope: "read_products" };

type FetchHandler = (url: string, init: RequestInit) => Promise<Response> | Response;

function adapter(handler: FetchHandler) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  };
  const refresher = new ShopifyTokenRefresh({ sessions: store(), clientId: "client-id", clientSecret: "client-secret", fetch: fakeFetch, freshForMs: 300_000, timeoutMs: 5_000 });
  return { refresher, requests };
}

const seed = (shop = SHOP, overrides = {}) => store().storeSession(offlineSession(shop, { accessToken: "shpat_old", refreshToken: "shprt_old", expires: EXPIRED, ...overrides }));
const stored = async (shop = SHOP) => (await store().findSessionsByShop(shop))[0];

describe("ShopifyTokenRefresh", () => {
  // KV is not reset between tests, so start each one with no sessions for the shops used here.
  beforeEach(() => inRequest(async () => {
    for (const shop of [SHOP, "other.myshopify.com"]) {
      const found = await store().findSessionsByShop(shop);
      await store().deleteSessions(found.map(({ id }) => id));
    }
  }));

  it("exchanges the refresh token with the documented request and persists the whole new pair", async () => {
    const { refresher, requests } = adapter(() => json(200, GOOD));
    await inRequest(() => seed());

    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "refreshed" });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`https://${SHOP}/admin/oauth/access_token`);
    expect(requests[0]?.init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(requests[0]?.init.body)))).toEqual({
      client_id: "client-id", client_secret: "client-secret", grant_type: "refresh_token", refresh_token: "shprt_old",
    });
    const session = await inRequest(() => stored());
    expect(session).toMatchObject({ accessToken: "shpat_new", refreshToken: "shprt_new", scope: "read_products" });
    expect(session?.expires?.getTime()).toBe(NOW + 3_600_000);
    expect(session?.refreshTokenExpires?.getTime()).toBe(NOW + 7_776_000_000);
  });

  it("does not call Shopify when the access token is still comfortably valid", async () => {
    const { refresher, requests } = adapter(() => json(200, GOOD));
    await inRequest(() => seed(SHOP, { expires: new Date(NOW + 3_000_000) }));
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "fresh" });
    expect(requests).toHaveLength(0);
  });

  it("has nothing to probe with when there is no session, an online-only session, or no refresh token", async () => {
    const { refresher, requests } = adapter(() => json(200, GOOD));
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "no_session" });
    await inRequest(() => store().storeSession(offlineSession(SHOP, { id: "online_1", isOnline: true, refreshToken: "x", expires: EXPIRED })));
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "no_session" });
    await inRequest(() => seed(SHOP, { refreshToken: undefined }));
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "no_session" });
    expect(requests).toHaveLength(0);
  });

  it("reads Shopify's single terminal answer (401 invalid_request) as terminal, and leaves the stored pair alone", async () => {
    const { refresher } = adapter(() => json(401, { error: "invalid_request", error_description: "This request requires an active refresh_token." }));
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "terminal" });
    expect(await inRequest(() => stored())).toMatchObject({ accessToken: "shpat_old", refreshToken: "shprt_old" });
  });

  it("does not call a 401 terminal when somebody else replaced the pair while the request was in flight", async () => {
    const { refresher } = adapter(async () => {
      await seed(SHOP, { accessToken: "shpat_lib", refreshToken: "shprt_lib", expires: new Date(NOW + 3_600_000) });
      return json(401, { error: "invalid_request" });
    });
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "superseded" });
  });

  it("never overwrites a pair stored by someone else, even when its own exchange succeeded", async () => {
    const { refresher } = adapter(async () => {
      await seed(SHOP, { accessToken: "shpat_lib", refreshToken: "shprt_lib", expires: new Date(NOW + 3_600_000) });
      return json(200, GOOD);
    });
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "superseded" });
    expect(await inRequest(() => stored())).toMatchObject({ accessToken: "shpat_lib", refreshToken: "shprt_lib" });
  });

  it("treats a session deleted mid-flight (uninstall cleanup ran) as superseded, not terminal", async () => {
    const { refresher } = adapter(async () => {
      await store().deleteSession(`offline_${SHOP}`);
      return json(401, { error: "invalid_request" });
    });
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "superseded" });
  });

  it.each([[429], [500], [502], [503]])("treats HTTP %i as transient", async (status) => {
    const { refresher } = adapter(() => json(status, { error: "busy" }));
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "transient", detail: `http_${status}` });
  });

  it("treats a network failure as transient", async () => {
    const { refresher } = adapter(() => { throw new TypeError("network down"); });
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "transient", detail: "TypeError" });
  });

  it.each([
    ["rejected credentials", 400, { error: "invalid_client" }],
    ["a 401 that is not invalid_request", 401, { error: "access_denied" }],
    ["a 401 with a non-JSON body", 401, "<html>"],
    ["forbidden", 403, { error: "nope" }],
  ])("never reads %s as an uninstall", async (_label, status, body) => {
    const { refresher } = adapter(() => typeof body === "string" ? new Response(body, { status }) : json(status, body));
    await inRequest(() => seed());
    const outcome = await inRequest(() => refresher.refresh(SHOP, NOW));
    expect(outcome.kind).toBe("unexpected");
  });

  it("refuses a malformed success body and keeps the stored pair", async () => {
    const { refresher } = adapter(() => json(200, { access_token: "shpat_x" }));
    await inRequest(() => seed());
    await expect(inRequest(() => refresher.refresh(SHOP, NOW))).resolves.toEqual({ kind: "unexpected", detail: "malformed_refresh_response" });
    expect(await inRequest(() => stored())).toMatchObject({ accessToken: "shpat_old", refreshToken: "shprt_old" });
  });

  it("refuses a value that is not a myshopify.com domain before any request is made", async () => {
    const { refresher, requests } = adapter(() => json(200, GOOD));
    await expect(inRequest(() => refresher.refresh("evil.example.com/path", NOW))).resolves.toEqual({ kind: "unexpected", detail: "invalid_shop_domain" });
    expect(requests).toHaveLength(0);
  });

  it("only ever reads and writes the shop it was asked about", async () => {
    const { refresher, requests } = adapter(() => json(200, GOOD));
    await inRequest(async () => {
      await seed(SHOP);
      await seed("other.myshopify.com", { refreshToken: "shprt_other" });
    });
    await inRequest(() => refresher.refresh(SHOP, NOW));
    expect(String(requests[0]?.init.body)).not.toContain("shprt_other");
    expect(await inRequest(() => stored("other.myshopify.com"))).toMatchObject({ accessToken: "shpat_old", refreshToken: "shprt_other" });
  });
});
