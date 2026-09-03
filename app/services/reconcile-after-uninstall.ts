import { reconcileShop, type ShopReconciler } from "./reconcile-shop";

export type UninstallReconciliationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly detail: string };

export type UninstallReconciliationDependencies = ShopReconciler;

/** Performs both Shopify reads; the queue retries any incomplete reconciliation. */
export async function reconcileAfterUninstall(
  dependencies: UninstallReconciliationDependencies,
): Promise<UninstallReconciliationResult> {
  const result = await reconcileShop(dependencies);
  if (result.status === "failed") return { ok: false, code: result.code, detail: result.detail };
  return { ok: true };
}
