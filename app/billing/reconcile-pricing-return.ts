import { isPricingReturn } from "./pricing-return";
import { reconcileShop, type ShopReconciler } from "~/services/reconcile-shop";

export type PricingReturnReconciler = ShopReconciler;

/** Reconcile both current state and event history after hosted pricing returns. */
export async function reconcilePricingReturn(
  requestUrl: string,
  reconciler: PricingReturnReconciler,
): Promise<void> {
  if (!isPricingReturn(requestUrl)) return;
  const result = await reconcileShop(reconciler);
  if (result.status === "failed") throw new Error(`${result.code}: ${result.detail}`);
}
