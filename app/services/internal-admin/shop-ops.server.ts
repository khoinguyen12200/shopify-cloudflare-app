import {
  shops,
  shopSubscriptions,
  supportService,
  webhookScopeObservations,
} from "~/wiring.server";
import { planForShopifyHandle } from "~/billing/plans";
import { statusOf } from "~/support/status";

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
