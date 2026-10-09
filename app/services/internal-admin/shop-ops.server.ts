import {
  shops,
  shopMetrics,
  shopSubscriptions,
  supportService,
  webhookScopeObservations,
  planGrants,
  invalidateEntitlements,
} from "~/wiring.server";
import { PLAN_LIST, planForShopifyHandle } from "~/billing/plans";
import { statusOf } from "~/support/status";
import { nanoid } from "nanoid";

/** Display name for a stored plan handle; no subscription means the free plan. */
function planNameFor(planHandle: string | null): string {
  return planForShopifyHandle(planHandle)?.name ?? (planHandle ? planHandle : "Free");
}

/**
 * Lower-cased handles a `plan` filter can mean: the text itself (an unknown
 * handle is its own display name), plus every known plan whose handle or name
 * equals it. `free` also matches shops with no subscription — see the repo.
 */
function planHandleCandidates(plan: string): string[] {
  const wanted = plan.toLowerCase();
  const known = PLAN_LIST
    .filter((p) => p.handle.toLowerCase() === wanted || p.name.toLowerCase() === wanted)
    .map((p) => p.handle.toLowerCase());
  return [...new Set([wanted, ...known])];
}

/** Newly installed stores in the last N hours. */
export async function listNewStores({
  sinceHours = 24,
  type = "all",
  now = Date.now(),
}: {
  sinceHours?: number;
  type?: "real" | "dev" | "all";
  now?: number;
} = {}) {
  const cutoff = now - sinceHours * 60 * 60 * 1000;
  const rows = await shopMetrics().installedSince(cutoff, type);

  return rows.map((shop) => ({
    shop: shop.shop,
    name: shop.name,
    email: shop.email,
    contactEmail: shop.contactEmail,
    logoUrl: shop.logoUrl,
    installedAt: shop.installedAt,
    isDevStore: shop.isDevStore,
    relationshipStatus: shop.relationshipStatus,
    planName: planNameFor(shop.planHandle),
    active: shop.uninstalledAt === null,
  }));
}

/** Directory of stores with filtering; filtered and limited by the database. */
export async function listShopsDirectory({
  filter = "all",
  type = "all",
  plan,
  limit = 50,
}: {
  filter?: "all" | "active" | "uninstalled";
  type?: "all" | "real" | "dev";
  plan?: string;
  limit?: number;
} = {}) {
  const rows = await shopMetrics().directory({
    activity: filter,
    kind: type,
    planHandles: plan ? planHandleCandidates(plan) : undefined,
    limit,
  });

  return rows.map((shop) => ({
    shop: shop.shop,
    name: shop.name,
    email: shop.email,
    contactEmail: shop.contactEmail,
    logoUrl: shop.logoUrl,
    url: shop.url,
    shopifyShopId: shop.shopifyShopId,
    installedAt: shop.installedAt,
    uninstalledAt: shop.uninstalledAt,
    relationshipStatus: shop.relationshipStatus,
    isDevStore: shop.isDevStore,
    planHandle: shop.planHandle ?? "free",
    planName: planNameFor(shop.planHandle),
    billingInterval: shop.billingInterval,
    subscriptionStatus: shop.subscriptionStatus ?? "NONE",
  }));
}

/** Complete dossier for a single shop. */
export async function getShopDossier(shopDomain: string) {
  const [shop, sub, tickets] = await Promise.all([
    shops().get(shopDomain),
    shopSubscriptions().currentForShop(shopDomain),
    supportService().listOpenForStaff(),
  ]);

  if (!shop) return null;

  const shopTickets = tickets.filter((t) => t.shop === shopDomain);

  return {
    shop: shop.shop,
    name: shop.name,
    email: shop.email,
    contactEmail: shop.contactEmail,
    logoUrl: shop.logoUrl,
    url: shop.url,
    shopifyShopId: shop.shopifyShopId,
    installedAt: shop.installedAt,
    uninstalledAt: shop.uninstalledAt,
    relationshipStatus: shop.relationshipStatus,
    isDevStore: shop.isDevStore,
    lastAuthenticatedAt: shop.lastAuthenticatedAt,
    subscription: sub
      ? {
          status: sub.status,
          planHandle: sub.planHandle,
          planName: planForShopifyHandle(sub.planHandle)?.name ?? sub.planHandle,
          billingInterval: sub.billingInterval,
          priceAmount: sub.priceAmount,
          priceCurrency: sub.priceCurrency,
          currentPeriodEndsAt: sub.currentPeriodEndsAt,
        }
      : null,
    tickets: shopTickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: statusOf(t),
      lastMessageAt: t.lastMessageAt,
    })),
  };
}

/** Set or override a shop's development store status. */
export async function setShopDevStatus(shopDomain: string, isDevStore: boolean) {
  const shop = await shops().get(shopDomain);
  if (!shop) return false;
  await shops().setDevStatus(shopDomain, isDevStore);
  return true;
}

/** Shop webhook status & scopes. */
export async function getShopWebhookStatus(shopDomain: string) {
  const [shop, scopes] = await Promise.all([
    shops().get(shopDomain),
    webhookScopeObservations().listGrantedForShop(shopDomain),
  ]);

  if (!shop) return null;

  return {
    shop: shop.shop,
    lastWebhookAt: shop.lastWebhookAt,
    relationshipStatus: shop.relationshipStatus,
    grantedScopes: scopes,
  };
}

/** Grant a promotional plan override to a shop. */
export async function grantShopPromoPlan(
  shopDomain: string,
  {
    planHandle,
    durationDays,
    reason,
    grantedBy,
  }: {
    planHandle: string;
    durationDays: number;
    reason: string;
    grantedBy: string;
  },
) {
  const shop = await shops().get(shopDomain);
  if (!shop) throw new Error(`Shop not found: ${shopDomain}`);

  const matchedPlan = PLAN_LIST.find((p) => p.handle === planHandle);
  if (!matchedPlan || matchedPlan.priceMonthly.amount === 0) {
    throw new Error(`Invalid plan for promotional grant: ${planHandle}`);
  }

  if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 365) {
    throw new Error(`Invalid duration: must be between 1 and 365 days`);
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    throw new Error(`A reason is required to grant a promotional plan`);
  }

  const now = Date.now();
  const expiresAt = now + durationDays * 86_400_000;

  const grant = await planGrants().createGrant({
    id: `grant_${nanoid(16)}`,
    shop: shopDomain,
    planHandle,
    reason: trimmedReason,
    grantedBy,
    startsAt: now,
    expiresAt,
    createdAt: now,
  });

  await invalidateEntitlements(shopDomain);

  return grant;
}

/** Revoke an active promotional plan grant for a shop. */
export async function revokeShopPromoPlan(
  shopDomain: string,
  grantId: string,
  revokedBy: string,
) {
  const success = await planGrants().revokeGrant(shopDomain, grantId, revokedBy, Date.now());
  if (success) {
    await invalidateEntitlements(shopDomain);
  }
  return success;
}

/** Get active promo grant and history for a shop. */
export async function getShopPromoStatus(shopDomain: string, now: number = Date.now()) {
  const [activeGrant, history] = await Promise.all([
    planGrants().findActiveGrant(shopDomain, now),
    planGrants().listGrantsForShop(shopDomain),
  ]);
  return { activeGrant, history };
}
