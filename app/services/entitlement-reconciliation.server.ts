import type { HeldDecision, HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";
export type { HeldDecision, HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";

type ReconcileOptions = { readonly cursor?: string; readonly limit?: number };

export async function reconcileHeld(
  shop: string,
  port: HeldReconciliationPort,
  decide: (item: HeldItem) => HeldDecision | Promise<HeldDecision>,
  options: ReconcileOptions = {},
) {
  let committed = 0;
  let allocated = 0;
  let released = 0;
  const failures: { id: string; key: string; reason: string }[] = [];
  const page = await port.listHeld(shop, options.cursor, options.limit);
  // Sequential on purpose, not an N+1: each `apply` is its own transactional state
  // transition guarded by the item's current state (@rules/data.md: a guard and
  // its write are never split). Batching would merge independent guards into one
  // statement and let one stale item fail or commit its neighbours. The page
  // size (`limit`) is the bound; `decide` may also be async per item.
  for (const item of page.items) {
    const decision = await decide(item);
    if (decision === "ignore") continue;
    const action = typeof decision === "string" ? decision : decision.action;
    const valid = item.kind === "quota"
      ? action === "commit" || action === "release"
      : action === "confirm" || action === "release";
    const result = valid
      ? await port.apply(shop, item, action, typeof decision === "string" ? undefined : decision.actualAmount)
      : { reason: "invalid_decision" as const };
    if ("reason" in result) failures.push({ id: item.id, key: item.key, reason: result.reason });
    else if (result.state === "committed") committed += 1;
    else if (result.state === "allocated") allocated += 1;
    else released += 1;
  }
  return page.nextCursor === undefined
    ? { processed: committed + allocated + released, committed, allocated, released, failures }
    : { processed: committed + allocated + released, committed, allocated, released, failures, nextCursor: page.nextCursor };
}
