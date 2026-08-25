/**
 * Shopify's hosted Managed Pricing page for this shop and app — where the
 * merchant actually subscribes, upgrades, downgrades, or cancels. This app
 * never builds its own plan-selection UI; it only links here.
 */
export function pricingPlansUrl(shop: string, appHandle: string): string {
  const storeHandle = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}
