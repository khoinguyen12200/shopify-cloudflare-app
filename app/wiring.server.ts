import { WorkersAiGenerator, workersAiModelFactory } from "~/adapters/workers-ai.server";
import { allowAll, type AiGate } from "~/ai/gate";
import type { TextGenerator } from "~/ports/ai";
import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { ShopRepo } from "~/models/shops.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { refreshSubscription } from "~/services/reconcile-subscription";
import type { AdminUserPort } from "~/ports/admin-users";
import type { PasswordResetTokenPort } from "~/ports/password-reset-tokens";

export function adminUsers(): AdminUserPort {
  return new AdminUserRepo();
}

export function passwordResetTokens(): PasswordResetTokenPort {
  const repo = new PasswordResetTokenRepo();
  return {
    create: (input) => repo.create(input),
    findByHash: (hash) => repo.findByHash(hash),
    markUsed: (hash, now) => repo.markUsed(hash, now),
    invalidateAllForUser: (id, now) => repo.invalidateAllForUser(id, now),
    countActiveForUser: (id, now) => repo.countActiveForUser(id, now),
    cleanup: (cutoff) => repo.deleteExpiredBefore(cutoff),
  };
}

/** Targeted billing refresh composition. Missing Partner credentials stay observable. */
export async function refreshShopSubscription(env: Env, shop: string, now = Date.now()) {
  const identity = await new ShopRepo().get(shop);
  const partner = new ShopifyPartnerAdapter({ token: env.SHOPIFY_PARTNER_API_TOKEN || "", fetch });
  return refreshSubscription({
    partner,
    subscriptions: { upsertSubscriptionProjection: (tenant, observation) => new ShopSubscriptionRepo().upsertObservation(tenant, observation) },
    clock: { now: () => now },
    appId: env.SHOPIFY_PARTNER_APP_ID || null,
  }, { shop, shopifyShopId: identity?.shopifyShopId ?? null }, now);
}

/** History ledger adapter binding kept here so services never import models. */
export function historyLedger() {
  const repo = new ShopifyEventRepo();
  return {
    recordPartnerRelationship: (event: Parameters<ShopifyEventRepo["recordPartnerRelationship"]>[0]) => repo.recordPartnerRelationship(event),
    recordPartnerSubscription: (event: Parameters<ShopifyEventRepo["recordPartnerSubscription"]>[0]) => repo.recordPartnerSubscription(event),
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
