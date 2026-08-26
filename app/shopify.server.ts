// Workers runtime adapter (Web Crypto + global fetch) — replaces the Node
// adapter the upstream template ships with. Must be imported before shopifyApp.
import "@shopify/shopify-api/adapters/cf-worker";

import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

import { KVSessionStorage } from "./session-storage.server";
import { ShopRepo } from "~/models/shops.server";

export const apiVersion = ApiVersion.October26;

/**
 * Record (or revive) an install the moment a shop gets a session.
 *
 * THIS IS THE ONLY PLACE A `shops` ROW IS EVER CREATED, and it has to be,
 * because this app never runs the OAuth callback. `@shopify/shopify-app-react-router`
 * v2 ships exactly two auth strategies — token exchange and merchant-custom-app
 * — and with `AppDistribution.AppStore` it always picks token exchange
 * (`shopify-app.mjs`). Installation is Shopify-managed and the access token is
 * minted inside `authenticate.admin` on the first embedded page load, so
 * `/auth/callback` is never part of the install path. Recording the install
 * there, as the older auth-code-flow templates do, means it is never recorded
 * at all: the shop authenticates, uses the app, writes tickets — and `shops`
 * stays empty, so the internal console shows no shops and the app's own home
 * page reports the install as missing.
 *
 * The library calls this ONLY when it mints a new session — not on every
 * request — see the `!session || !session.isActive(...)` branch in
 * `strategies/token-exchange.mjs`. Offline tokens expire
 * (`expiringOfflineAccessTokens`), so it fires again on every renewal, which is
 * why `recordInstall` upserts rather than inserts.
 *
 * Exported so the behaviour is testable: `shopifyApp` does not expose its
 * hooks, so a test cannot reach this through the built instance.
 */
export async function afterAuth({
  session,
}: {
  session: { shop: string };
}): Promise<void> {
  await new ShopRepo().recordInstall(session.shop, Date.now());
}

function buildShopify(env: Env) {
  return shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET || "",
    apiVersion,
    scopes: env.SCOPES?.split(",").filter(Boolean),
    appUrl: env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: new KVSessionStorage(env.SESSION),
    distribution: AppDistribution.AppStore,
    hooks: { afterAuth },
    future: {
      expiringOfflineAccessTokens: true,
    },
    ...(env.SHOP_CUSTOM_DOMAIN
      ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
      : {}),
  });
}

type ShopifyAppInstance = ReturnType<typeof buildShopify>;

// There is no process.env at module load in workerd — config arrives as the
// per-request `env` binding, so `shopifyApp` cannot be built at import time the
// way the Node template does it. Building it is cheap, but memoize per `env`
// object so repeated calls within one isolate reuse a single instance.
const cache = new WeakMap<Env, ShopifyAppInstance>();

/**
 * Get the Shopify app for this request's env.
 *
 * Routes call it as `const shopify = createShopify(getEnv())`, then
 * `shopify.authenticate.admin(request)`.
 */
export function createShopify(env: Env): ShopifyAppInstance {
  const existing = cache.get(env);
  if (existing) return existing;

  const shopify = buildShopify(env);
  cache.set(env, shopify);
  return shopify;
}
