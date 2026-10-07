import {
  shops,
  shopSubscriptions,
  supportService,
  webhookScopeObservations,
  planGrants,
  invalidateEntitlements,
} from "~/wiring.server";
import { PLAN_LIST, planForShopifyHandle } from "~/billing/plans";
import { statusOf } from "~/support/status";
import { nanoid } from "nanoid";

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
  const [allShops, subscriptions] = await Promise.all([
    shops().listAll(),
    shopSubscriptions().listCurrent(),
  ]);

  const subByShop = new Map(subscriptions.map((s) => [s.shop, s]));

  return allShops
    .filter((s) => s.installedAt >= cutoff)
    .filter((s) => {
      if (type === "real") return !s.isDevStore;
      if (type === "dev") return s.isDevStore;
      return true;
    })
    .map((shop) => {
      const sub = subByShop.get(shop.shop);
      return {
        shop: shop.shop,
        name: shop.name,
        email: shop.email,
        contactEmail: shop.contactEmail,
        logoUrl: shop.logoUrl,
        installedAt: shop.installedAt,
        isDevStore: shop.isDevStore,
        relationshipStatus: shop.relationshipStatus,
        planName: planForShopifyHandle(sub?.planHandle)?.name ?? (sub?.planHandle ? sub.planHandle : "Free"),
        active: shop.uninstalledAt === null,
      };
    });
}

/** Directory of stores with filtering. */
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
  const [allShops, subscriptions] = await Promise.all([
    shops().listAll(),
    shopSubscriptions().listCurrent(),
  ]);

  const subByShop = new Map(subscriptions.map((s) => [s.shop, s]));

  let filtered = allShops;
  if (filter === "active") filtered = filtered.filter((s) => s.uninstalledAt === null);
  if (filter === "uninstalled") filtered = filtered.filter((s) => s.uninstalledAt !== null);

  if (type === "real") filtered = filtered.filter((s) => !s.isDevStore);
  if (type === "dev") filtered = filtered.filter((s) => s.isDevStore);

  const mapped = filtered.map((shop) => {
    const sub = subByShop.get(shop.shop);
    const planHandle = sub?.planHandle ?? "free";
    const planName = planForShopifyHandle(sub?.planHandle)?.name ?? (sub?.planHandle ? sub.planHandle : "Free");
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
      planHandle,
      planName,
      billingInterval: sub?.billingInterval ?? null,
      subscriptionStatus: sub?.status ?? "NONE",
    };
  });

  if (plan) {
    return mapped
      .filter((s) => s.planHandle.toLowerCase() === plan.toLowerCase() || s.planName.toLowerCase() === plan.toLowerCase())
      .slice(0, limit);
  }

  return mapped.slice(0, limit);
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
  const success = await planGrants().revokeGrant(shopDomain, grantId, revokedBy);
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
