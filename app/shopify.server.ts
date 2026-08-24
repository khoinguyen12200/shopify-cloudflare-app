// Workers runtime adapter (Web Crypto + global fetch) — replaces the Node
// adapter the upstream template ships with. Must be imported before shopifyApp.
import "@shopify/shopify-api/adapters/cf-worker";

import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

import { KVSessionStorage } from "./session-storage.server";

export const apiVersion = ApiVersion.October26;

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
