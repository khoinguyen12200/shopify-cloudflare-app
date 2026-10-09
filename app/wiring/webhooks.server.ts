import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ShopifyTokenRefresh } from "~/adapters/shopify-token-refresh.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { ShopRepo } from "~/models/shops.server";
import { ShopTokenProbeRepo } from "~/models/shop-token-probes.server";
import { TenantPurgeRepo } from "~/models/tenant-purge.server";
import { getEnv } from "~/request-context.server";
import { KVSessionStorage } from "~/session-storage.server";
import { probeInstalledShops } from "~/services/probe-installed-shops";
import { reconcileAfterUninstall } from "~/services/reconcile-after-uninstall";
import { reconcileHistory } from "~/services/reconcile-shopify-history";
import { recordUninstall, type RecordUninstallPorts } from "~/services/record-uninstall";
import type { WebhookHandlerRegistry } from "~/services/webhook-consumer";
import { appScopesUpdateHandler } from "~/services/webhook-handlers/app-scopes-update";
import { appUninstalledHandler } from "~/services/webhook-handlers/app-uninstalled";
import { complianceHandler } from "~/services/webhook-handlers/compliance";
import { historyLedger, refreshShopHistory, refreshShopSubscription } from "~/wiring/billing.server";
import { invalidateEntitlements } from "~/wiring/entitlement-cache.server";
import { shops, shopSyncCheckpoints, support, webhookDeliveryRepository, webhookScopeObservations } from "~/wiring/repositories.server";
import { appRuntime } from "~/wiring/runtime.server";

export function tenantPurgeDependencies() {
  const env = getEnv();
  const storage = new KVSessionStorage(env.SESSION);
  const repo = new TenantPurgeRepo();
  return {
    d1: {
      prepare: (shop: string) => repo.prepareTenantPurge(shop),
      deleteRows: (shop: string) => repo.deleteTenantRows(shop),
    },
    r2: { delete: (keys: readonly string[]) => env.UPLOADS.delete([...keys]) },
    kv: {
      deleteSessions: async (shop: string) => {
        const sessions = await storage.findSessionsByShop(shop);
        await storage.deleteSessions(sessions.map(({ id }) => id));
        return sessions.length;
      },
    },
    entitlementCache: { invalidate: invalidateEntitlements },
  };
}

/** Everything the uninstall use case needs, bound to D1 and KV. Shared by the webhook handler and the cron probe. */
function recordUninstallPorts(env: Env): RecordUninstallPorts {
  const sessions = new KVSessionStorage(env.SESSION);
  const repository = new ShopRepo();
  return {
    shops: { facts: (shop) => repository.get(shop), applyUninstall: (shop, next) => repository.applyUninstall(shop, next) },
    cleanup: async (shop) => {
      await invalidateEntitlements(shop);
      const found = await sessions.findSessionsByShop(shop);
      await sessions.deleteSessions(found.map(({ id }) => id));
    },
    reconcile: (shop) => reconcileAfterUninstall({
      refreshSubscription: () => refreshShopSubscription(env, shop),
      refreshHistory: () => refreshShopHistory(env, shop),
    }),
  };
}

/**
 * The consumer's registry: one entry per `WebhookTopic`, so TypeScript fails the build when a topic is added without
 * a handler. A new topic is a new file under `app/services/webhook-handlers/`, one entry here, and one test.
 */
export function webhookConsumer() {
  const env = getEnv();
  const sessions = new KVSessionStorage(env.SESSION);
  const compliance = { tenantPurge: tenantPurgeDependencies(), now: appRuntime().clock.now };
  const handlers = {
    "app/uninstalled": appUninstalledHandler(recordUninstallPorts(env)),
    "app/scopes_update": appScopesUpdateHandler({
      shops: { facts: (shop) => shops().get(shop) },
      scopes: webhookScopeObservations(),
      sessions: {
        updateScope: async (shop, scope) => {
          const found = await sessions.findSessionsByShop(shop);
          await Promise.all(found.map(async (session) => { session.scope = scope; await sessions.storeSession(session); }));
        },
      },
    }),
    "customers/data_request": complianceHandler("CUSTOMERS_DATA_REQUEST", compliance),
    "customers/redact": complianceHandler("CUSTOMERS_REDACT", compliance),
    "shop/redact": complianceHandler("SHOP_REDACT", compliance),
  } satisfies WebhookHandlerRegistry;
  return {
    deliveries: webhookDeliveryRepository(),
    now: appRuntime().clock.now,
    isRedactedShop: async (shop: string) => (await shops().get(shop)) === undefined,
    handlers,
  };
}

export function scheduledDependencies() {
  const env = getEnv();
  const uploads = support();
  return {
    tokens: new PasswordResetTokenRepo(),
    uploads: {
      listExpiredUploads: (cutoff: number) => uploads.listExpiredUploads(cutoff),
      deleteExpiredUploads: (ids: readonly string[], cutoff: number) => uploads.deleteExpiredUploads(ids, cutoff),
      deleteUploadObjects: async (keys: readonly string[]) => {
        await env.UPLOADS.delete([...keys]);
      },
    },
    history: {
      reconcile: (now: number) => reconcileHistory({
        partner: new ShopifyPartnerAdapter({
          token: env.SHOPIFY_PARTNER_API_TOKEN || "",
          organizationId: env.SHOPIFY_PARTNER_ORGANIZATION_ID || "",
          apiVersion: env.SHOPIFY_PARTNER_API_VERSION || "",
          fetch,
        }),
        checkpoint: shopSyncCheckpoints(),
        ledger: historyLedger(),
        clock: { now: () => now },
        appId: env.SHOPIFY_PARTNER_APP_ID || null,
      }, now),
    },
    uninstallProbe: {
      run: (now: number) => probeInstalledShops({
        probes: new ShopTokenProbeRepo(),
        refresher: new ShopifyTokenRefresh({
          sessions: new KVSessionStorage(env.SESSION),
          clientId: env.SHOPIFY_API_KEY,
          clientSecret: env.SHOPIFY_API_SECRET,
          fetch,
          freshForMs: 5 * 60 * 1000,
          timeoutMs: 10_000,
        }),
        uninstall: (shop, observation) => recordUninstall(recordUninstallPorts(env), shop, observation),
        clock: appRuntime().clock,
      }, now),
    },
  };
}
