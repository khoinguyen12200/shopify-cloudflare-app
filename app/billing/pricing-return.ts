/** Whether Shopify returned a merchant from the hosted plan selection page. */
export function isPricingReturn(requestUrl: string): boolean {
  const planHandle = new URL(requestUrl).searchParams.get("plan_handle");
  return planHandle !== null && planHandle.trim().length > 0;
}

/**
 * The parameter only identifies a return from Shopify-hosted pricing. Its
 * value is never used as billing data; reconciliation completes first.
 */
export function pricingReturnDestination(requestUrl: string): string | null {
  const planHandle = new URL(requestUrl).searchParams.get("plan_handle");
  return planHandle !== null && planHandle.trim().length > 0
    ? `/app/billing?plan_handle=${encodeURIComponent(planHandle)}`
    : null;
}
