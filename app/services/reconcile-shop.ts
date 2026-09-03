export type SubscriptionRefreshResult =
  | { readonly status: "refreshed" }
  | { readonly status: "failed"; readonly code: string; readonly detail: string };

export type HistoryRefreshResult =
  | { readonly status: "succeeded"; readonly pages: number; readonly events: number }
  | { readonly status: "failed"; readonly code: string; readonly detail: string };

export interface ShopReconciler {
  readonly refreshSubscription: () => Promise<SubscriptionRefreshResult>;
  readonly refreshHistory: () => Promise<HistoryRefreshResult>;
}

export type ShopReconciliationResult =
  | { readonly status: "succeeded" }
  | { readonly status: "failed"; readonly code: string; readonly detail: string };

/**
 * Applies Shopify's current billing projection and audit history in one
 * reusable operation. Callers choose their own retry or HTTP error policy.
 */
export async function reconcileShop(reconciler: ShopReconciler): Promise<ShopReconciliationResult> {
  const [subscription, history] = await Promise.all([
    reconciler.refreshSubscription(),
    reconciler.refreshHistory(),
  ]);
  if (subscription.status === "failed") return subscription;
  if (history.status === "failed") return history;
  return { status: "succeeded" };
}
