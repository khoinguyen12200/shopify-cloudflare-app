import { WorkersAiGenerator, workersAiModelFactory } from "~/adapters/workers-ai.server";
import { allowAll, type AiGate } from "~/ai/gate";
import type { TextGenerator } from "~/ports/ai";
import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { ShopRepo } from "~/models/shops.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { AiRepo } from "~/models/ai.server";
import { OperationalHealthRepo } from "~/models/operational-health.server";
import { SupportRepo } from "~/models/support.server";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { WebhookScopeObservationRepo } from "~/models/webhook-scope-observations.server";
import { ShopSyncCheckpointRepo } from "~/models/shop-sync-checkpoints.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { TenantPurgeRepo } from "~/models/tenant-purge.server";
import { KVSessionStorage } from "~/session-storage.server";
import type { ConsumerDelivery, WebhookHandlerRegistry } from "~/services/webhook-consumer";
import { getEnv } from "~/request-context.server";
import { notify } from "~/notifications/notify.server";
import { notificationDependencies } from "~/wiring/notifications.server";
import type { PasswordResetNotifier } from "~/services/password-reset.server";
import { signAttachmentToken } from "~/support/file-token";
import { AiService } from "~/services/ai.server";
import { SupportService } from "~/services/support.server";
import { reconcileHistory, reconcileShopHistory } from "~/services/reconcile-shopify-history";
import { refreshSubscription } from "~/services/reconcile-subscription";
import type { AdminUserPort } from "~/ports/admin-users";
import type { PasswordResetTokenPort } from "~/ports/password-reset-tokens";
import { recordShopifyIdentity } from "~/services/record-shopify-identity";
import { reconcileAfterUninstall } from "~/services/reconcile-after-uninstall";
import type { AuthAttemptLimiter } from "~/ports/auth-rate-limit";
import { EntitlementRepo } from "~/models/entitlements.server";
import { createEntitlements, type EntitlementService } from "~/services/entitlements.server";
import type { EntitlementCachePort, ExistingQuotaOperation, SubscriptionPort } from "~/ports/entitlements";
import { ENTITLEMENT_CATALOGUE } from "~/billing/entitlement-catalogue";
import { createEntitlementCache, type EntitlementCacheAdapterPort } from "~/adapters/entitlement-cache.server";
import type { HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";

type HeldPosition = Pick<HeldItem, "createdAt" | "kind" | "key" | "id">;

function compareHeldPosition(left: HeldPosition, right: HeldPosition): number {
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  if (left.kind !== right.kind) return left.kind === "quota" ? -1 : 1;
  const keyOrder = left.key.localeCompare(right.key);
  if (keyOrder !== 0) return keyOrder;
  return left.id.localeCompare(right.id);
}

function encodeHeldCursor(item: HeldPosition): string {
  return encodeURIComponent(JSON.stringify(item));
}

function decodeHeldCursor(cursor: string | undefined): HeldPosition | undefined {
  if (cursor === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cursor));
    if (parsed === null || typeof parsed !== "object") return undefined;
    if (!("createdAt" in parsed) || !("kind" in parsed) || !("key" in parsed) || !("id" in parsed)) return undefined;
    return typeof parsed.createdAt === "number" && (parsed.kind === "quota" || parsed.kind === "capacity")
      && typeof parsed.key === "string" && typeof parsed.id === "string"
      ? { createdAt: parsed.createdAt, kind: parsed.kind, key: parsed.key, id: parsed.id }
      : undefined;
  } catch {
    return undefined;
  }
}

export function entitlementReconciliationPort(): HeldReconciliationPort {
  const repo = new EntitlementRepo();
  return {
    async listHeld(shop, cursor, limit) {
      const quota = await repo.listHeld(shop);
      const capacity = await repo.listHeldAllocations(shop);
      const items: HeldItem[] = [
        ...quota.map((row): HeldItem => ({ kind: "quota", shop, key: row.key, id: row.operationId, period: row.period, amount: row.amount, createdAt: row.createdAt })),
        ...capacity.map((row): HeldItem => ({ kind: "capacity", shop, key: row.key, id: row.allocationId, operationId: row.operationId, createdAt: row.createdAt })),
      ].sort(compareHeldPosition);
      const position = decodeHeldCursor(cursor);
      if (cursor !== undefined && position === undefined) return { items: [], nextCursor: undefined };
      const afterCursor = position === undefined ? items : items.filter((item) => compareHeldPosition(item, position) > 0);
      const pageSize = limit === undefined ? afterCursor.length : Math.max(0, limit);
      const page = afterCursor.slice(0, pageSize);
      const last = page.at(-1);
      return {
        items: page,
        nextCursor: last !== undefined && afterCursor.length > page.length ? encodeHeldCursor(last) : undefined,
      };
    },
    apply: (shop, item, decision, actualAmount) => repo.applyReconciliation(shop, item, decision, actualAmount),
  };
}

const SHOP_IDENTITY_QUERY = `#graphql
  query AuthenticatedShopIdentity {
    shop { id myshopifyDomain }
  }
`;

export async function persistShopIdentity(admin: { graphql: (query: string) => Promise<Response> }, shop: string, now = Date.now()) {
  const repository = new ShopRepo();
  const existing = await repository.get(shop);
  if (existing?.shopifyShopId) {
    return { status: "recorded", shopifyShopId: existing.shopifyShopId } as const;
  }
  const response = await admin.graphql(SHOP_IDENTITY_QUERY);
  if (!response.ok) return { status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" };
  const body: unknown = await response.json();
  if (body !== null && typeof body === "object" && "errors" in body && Array.isArray(body.errors) && body.errors.length > 0) {
    return { status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" };
  }
  const data = body !== null && typeof body === "object" && "data" in body ? body.data : null;
  const value = data !== null && typeof data === "object" && "shop" in data ? data.shop : null;
  const identity = value !== null && typeof value === "object" && "id" in value && "myshopifyDomain" in value
    && typeof value.id === "string" && typeof value.myshopifyDomain === "string"
    ? { id: value.id, myshopifyDomain: value.myshopifyDomain }
    : null;
  return recordShopifyIdentity({
    shop,
    queryShop: async () => identity,
    record: (tenant, shopifyShopId, at) => repository.recordAuthenticatedIdentity(tenant, shopifyShopId, at),
  }, now);
}

export function adminUsers(): AdminUserPort {
  return new AdminUserRepo();
}

/** Adapter factories are the only production boundary to repository classes. */
export type ShopsPort = Pick<ShopRepo, "get" | "recordAuthenticatedIdentity" | "recordInstall" | "recordUninstall" | "markReconciled" | "listAll">;
export type SupportPort = Pick<SupportRepo, "find" | "findForStaff" | "stageUpload" | "adoptPendingUploads" | "findAttachment" | "listForShop" | "listOpenForStaff" | "replyAsStaff" | "closeAsStaff" | "markReadAsStaff" | "setCcEmails" | "attach" | "open" | "reply" | "markRead" | "listExpiredUploads" | "deleteExpiredUploads">;
export type ShopSubscriptionsPort = Pick<ShopSubscriptionRepo, "currentForShop" | "listCurrent" | "upsertObservation">;
export type ShopifyEventsPort = Pick<ShopifyEventRepo, "listSubscriptionEvents" | "listRelationshipEvents" | "listRecentSubscriptionEvents" | "recordPartnerRelationship" | "recordPartnerSubscription">;
export type ShopSyncCheckpointsPort = Pick<ShopSyncCheckpointRepo, "read" | "markSucceeded" | "markFailed" | "readCheckpoint" | "markCheckpointSucceeded" | "markCheckpointFailed">;
export type WebhookScopeObservationsPort = Pick<WebhookScopeObservationRepo, "record" | "list" | "applyScopes">;
export type WebhookDeliveryRepositoryPort = Pick<WebhookDeliveryRepo, "listForShop" | "claim" | "get" | "markQueued" | "markProcessing" | "markProcessed" | "markFailed" | "markDeadLetter">;
export type OperationalHealthPort = Pick<OperationalHealthRepo, "read">;
export type AiRepositoryPort = Pick<AiRepo, "chainFor" | "markHealth" | "recordRun" | "allModels" | "tokensSince" | "recentRuns" | "addToChain" | "removeFromChain" | "reorder" | "setEnabled">;

export function shops(): ShopsPort { return new ShopRepo(); }
export function support(): SupportPort { return new SupportRepo(); }
export function shopSubscriptions(): ShopSubscriptionsPort { return new ShopSubscriptionRepo({ invalidate: invalidateEntitlements }); }
export function shopifyEvents(): ShopifyEventsPort { return new ShopifyEventRepo(); }
export function shopSyncCheckpoints(): ShopSyncCheckpointsPort { return new ShopSyncCheckpointRepo(); }
export function webhookScopeObservations(): WebhookScopeObservationsPort { return new WebhookScopeObservationRepo(); }
export function webhookDeliveryRepository(): WebhookDeliveryRepositoryPort { return new WebhookDeliveryRepo(); }
export function operationalHealth(): OperationalHealthPort { return new OperationalHealthRepo(); }
export function aiRepository(): AiRepositoryPort { return new AiRepo(); }

/** Advisory KV cache for entitlement previews; D1 remains authoritative. */
export function entitlementCache(): EntitlementCacheAdapterPort {
  return createEntitlementCache(getEnv().SESSION, { catalogueVersion: ENTITLEMENT_CATALOGUE.version });
}

export function entitlementCachePort(): EntitlementCachePort {
  const cache = entitlementCache();
  return {
    get: async (shop) => (await cache.get(shop))?.snapshot ?? null,
    set: async (shop, snapshot, _ttlSeconds) => cache.put(shop, { catalogueVersion: ENTITLEMENT_CATALOGUE.version, snapshot }),
    invalidate: (shop) => cache.delete(shop),
  };
}

async function invalidateEntitlements(shop: string): Promise<void> {
  try {
    await entitlementCache().delete(shop);
  } catch (error) {
    console.error(JSON.stringify({
      event: "entitlements.cache_invalidation_failed",
      shop,
      error: error instanceof Error ? error.message : "unknown",
    }));
  }
}

export function subscriptionsPort(): SubscriptionPort {
  const current = async (shop: string) => {
    const relationship = await shops().get(shop);
    if (!relationship || relationship.relationshipStatus !== "INSTALLED") return { status: "UNKNOWN" as const, planHandle: null, revision: 0 };
    const projection = await shopSubscriptions().currentForShop(shop);
    return { status: projection?.status ?? "UNKNOWN" as const, planHandle: projection?.planHandle ?? null,
      revision: projection?.revision ?? 0, periodStart: projection?.currentPeriodStartsAt ?? undefined,
      periodEnd: projection?.currentPeriodEndsAt ?? undefined,
      cancellationEffectiveAt: projection?.cancellationEffectiveAt ?? undefined };
  };
  return { current, async refresh(shop) {
    const env = getEnv();
    const result = await refreshShopSubscription(env, shop);
    if (result.status === "failed") throw new Error(result.detail);
    return current(shop);
  } };
}

export function entitlements(): EntitlementService {
  const repo = new EntitlementRepo();
  return createEntitlements({
    subscriptions: subscriptionsPort(),
    usage: {
      find: async (shop, operationId) => {
        const row = await repo.findOperation(shop, operationId);
        const state = row?.state;
        const validState = state === "held" || state === "committed" || state === "released";
        const operation: ExistingQuotaOperation | undefined = row && validState
          ? { key: row.key, amount: row.requestedAmount, period: row.period, subscriptionRevision: row.subscriptionRevision, state }
          : undefined;
        return operation;
      },
      reserve: (input) => repo.reserve(input),
      commit: async (input) => {
        const result = await repo.commit(input);
        return "reason" in result
          ? { allowed: false, reason: result.reason }
          : { allowed: true, operationId: input.operationId, state: "committed", ...(result.replayed ? { replayed: true } : {}) };
      },
      release: async (input) => {
        const result = await repo.release(input);
        return "reason" in result
          ? { allowed: false, reason: result.reason }
          : { allowed: true, operationId: input.operationId, state: result.state === "committed" ? "committed" : "released", ...(result.replayed ? { replayed: true } : {}) };
      },
    },
    capacity: { allocate: (input) => repo.allocate(input), confirmAllocation: (input) => repo.confirmAllocation(input), deallocate: (input) => repo.deallocate(input) },
    cache: entitlementCachePort(),
    catalogue: ENTITLEMENT_CATALOGUE,
  });
}

function authLimiter(binding: RateLimit | undefined): AuthAttemptLimiter {
  return {
    async check(key) {
      if (!binding) return "unavailable";
      try {
        const outcome = await binding.limit({ key });
        return outcome.success ? "allowed" : "limited";
      } catch (error) {
        console.error(JSON.stringify({
          event: "auth.rate_limit_unavailable",
          error: error instanceof Error ? error.message : "unknown",
        }));
        return "unavailable";
      }
    },
  };
}

export function requireAttachmentTokenSecret(env: { readonly ATTACHMENT_TOKEN_SECRET?: string; readonly SHOPIFY_API_SECRET?: string }): string {
  if (!env.ATTACHMENT_TOKEN_SECRET) {
    throw new Error("ATTACHMENT_TOKEN_SECRET is not configured");
  }
  return env.ATTACHMENT_TOKEN_SECRET;
}

export function authLimiters(): {
  readonly login: AuthAttemptLimiter;
  readonly passwordReset: AuthAttemptLimiter;
} {
  const env = getEnv();
  return {
    login: authLimiter(env.LOGIN_LIMITER),
    passwordReset: authLimiter(env.RESET_LIMITER),
  };
}

export function passwordResetTokens(): PasswordResetTokenPort {
  const repo = new PasswordResetTokenRepo();
  return {
    create: (input) => repo.create(input),
    findByHash: (hash) => repo.findByHash(hash),
    markUsed: (hash, now) => repo.markUsed(hash, now),
    invalidateAllForUser: (id, now) => repo.invalidateAllForUser(id, now),
    countActiveForUser: (id, now) => repo.countActiveForUser(id, now),
  };
}

export function passwordResetNotifier(): PasswordResetNotifier {
  return { send: (input) => notify(input, notificationDependencies()) };
}

/** Targeted billing refresh composition. Missing Partner credentials stay observable. */
export async function refreshShopSubscription(env: Env, shop: string, now = Date.now()) {
  const identity = await shops().get(shop);
  const partner = new ShopifyPartnerAdapter({
    token: env.SHOPIFY_PARTNER_API_TOKEN || "",
    organizationId: env.SHOPIFY_PARTNER_ORGANIZATION_ID || "",
    apiVersion: env.SHOPIFY_PARTNER_API_VERSION || "",
    fetch,
  });
  return refreshSubscription({
    partner,
    subscriptions: { upsertSubscriptionProjection: (tenant, observation) => shopSubscriptions().upsertObservation(tenant, observation) },
    clock: { now: () => now },
    appId: env.SHOPIFY_PARTNER_APP_ID || null,
  }, { shop, shopifyShopId: identity?.shopifyShopId ?? null, installedAt: identity?.installedAt ?? null }, now);
}

export async function refreshShopHistory(env: Env, shop: string, now = Date.now()) {
  const identity = await shops().get(shop);
  const checkpoints = shopSyncCheckpoints();
  const result = await reconcileShopHistory({
    partner: new ShopifyPartnerAdapter({ token: env.SHOPIFY_PARTNER_API_TOKEN || "", organizationId: env.SHOPIFY_PARTNER_ORGANIZATION_ID || "", apiVersion: env.SHOPIFY_PARTNER_API_VERSION || "", fetch }),
    ledger: historyLedger(),
    clock: { now: () => now },
    appId: env.SHOPIFY_PARTNER_APP_ID || null,
  }, { shop, shopifyShopId: identity?.shopifyShopId ?? null, installedAt: identity?.installedAt ?? null }, now);
  const checkpointName = `partner_history:${shop}`;
  if (result.status === "succeeded") {
    await Promise.all([
      shops().markReconciled(shop, now),
      checkpoints.markSucceeded(checkpointName, null, now, now),
    ]);
  } else {
    await checkpoints.markFailed(checkpointName, result.code, result.detail, now);
  }
  return result;
}

/** History ledger adapter binding kept here so services never import models. */
export function historyLedger() {
  const repo = shopifyEvents();
  return {
    recordPartnerRelationship: (event: Parameters<ShopifyEventRepo["recordPartnerRelationship"]>[0]) => repo.recordPartnerRelationship(event),
    recordPartnerSubscription: async (event: Parameters<ShopifyEventRepo["recordPartnerSubscription"]>[0]) => {
      const result = await repo.recordPartnerSubscription(event);
      await invalidateEntitlements(event.shop);
      return result;
    },
  };
}

/**
 * THE COMPOSITION ROOT — the one place a port is bound to an adapter.
 *
 * It exists because @rules/architecture.md forbids ring 3 importing ring 4: a
 * use case declares a port and RECEIVES an implementation, it never names one.
 * `AiService` used to import the Workers AI adapter directly, which quietly made
 * the service impossible to run against anything else and dragged the provider
 * into every test that touched it.
 *
 * Everything an app is likely to change about AI is a line in this file:
 *
 *   - a different provider            → swap `aiGenerator`
 *   - a gating policy                 → `composeGates(...)` into `aiGate`
 *   - AI switched off entirely        → a generator that always refuses
 *
 * Built per REQUEST, not at module load: bindings arrive on the request `env`,
 * and a module-level instance would be shared across shops in a reused isolate
 * (@rules/architecture.md — no mutable module state).
 */

/** The text generator every AI use case runs on. */
export function aiGenerator(): TextGenerator {
  return new WorkersAiGenerator({ languageModel: workersAiModelFactory() });
}

export function aiService(): AiService {
  return new AiService({ repo: aiRepository(), generator: aiGenerator(), clock: { now: () => Date.now() }, gate: aiGate() });
}

export function supportService(): SupportService {
  const env = getEnv();
  return new SupportService({
    repo: support(),
    admins: adminUsers(),
    clock: { now: () => Date.now() },
    notifier: { send: async (input) => { await notify(input, notificationDependencies()); } },
    appUrl: env.SHOPIFY_APP_URL,
    withinRateLimit: async (shop) => env.SUPPORT_LIMITER ? (await env.SUPPORT_LIMITER.limit({ key: shop })).success : true,
    signAttachment: async (attachmentId, expiresAt) => signAttachmentToken({ secret: requireAttachmentTokenSecret(env), attachmentId, expiresAt }),
  });
}

export function webhookDeliveries() {
  return webhookDeliveryRepository();
}

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

export function webhookConsumer() {
  const env = getEnv();
  const sessions = new KVSessionStorage(env.SESSION);
  const scopes = webhookScopeObservations();
  const handlers = {
    "app/uninstalled": async (delivery: ConsumerDelivery) => {
      await shops().recordUninstall(delivery.shop, Date.now());
      await invalidateEntitlements(delivery.shop);
      const found = await sessions.findSessionsByShop(delivery.shop);
      await sessions.deleteSessions(found.map(({ id }) => id));
      const result = await reconcileAfterUninstall({
        refreshSubscription: () => refreshShopSubscription(env, delivery.shop),
        refreshHistory: () => refreshShopHistory(env, delivery.shop),
      });
      if (!result.ok) {
        console.error(JSON.stringify({ event: "shopify.uninstall.reconciliation_failed", shop: delivery.shop, code: result.code, detail: result.detail }));
      }
    },
    "app/scopes_update": async (delivery: ConsumerDelivery) => {
      const current = await scopes.list(delivery.id, delivery.shop);
      await scopes.applyScopes(delivery.id, delivery.shop, current, Date.now());
      const found = await sessions.findSessionsByShop(delivery.shop);
      await Promise.all(found.map(async (session) => { session.scope = current.join(","); await sessions.storeSession(session); }));
    },
  } satisfies WebhookHandlerRegistry;
  return {
    deliveries: webhookDeliveryRepository(),
    now: Date.now,
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
  };
}

/**
 * Who may use AI.
 *
 * `allowAll` in the base: a policy is the app's decision, not the base's. An
 * app returns `composeGates(...)` here — see `~/ai/gate` for the shape and a
 * worked plan-gating example. This is the ONLY file that has to change.
 */
export function aiGate(): AiGate {
  return allowAll;
}
