export interface AdminShopIdentity {
  readonly id: string;
  readonly myshopifyDomain: string;
}

export type RecordShopifyIdentityResult =
  | { readonly status: "recorded"; readonly shopifyShopId: string }
  | { readonly status: "failed"; readonly code: "SHOP_IDENTITY_MISMATCH" | "INVALID_SHOP_IDENTITY" | "SHOP_IDENTITY_QUERY_FAILED" };

export async function recordShopifyIdentity(deps: {
  readonly shop: string;
  readonly queryShop: () => Promise<AdminShopIdentity | null>;
  readonly record: (shop: string, shopifyShopId: string, now: number) => Promise<void>;
}, now: number): Promise<RecordShopifyIdentityResult> {
  let identity: AdminShopIdentity | null;
  try {
    identity = await deps.queryShop();
  } catch {
    return { status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" };
  }
  if (!identity?.id || !identity.myshopifyDomain) {
    return { status: "failed", code: "INVALID_SHOP_IDENTITY" };
  }
  if (identity.myshopifyDomain !== deps.shop) {
    return { status: "failed", code: "SHOP_IDENTITY_MISMATCH" };
  }
  await deps.record(deps.shop, identity.id, now);
  return { status: "recorded", shopifyShopId: identity.id };
}
