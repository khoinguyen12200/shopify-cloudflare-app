import type { HeldDecision, HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";
export type { HeldDecision, HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";

export async function reconcileHeld(
  shop: string,
  port: HeldReconciliationPort,
  decide: (item: HeldItem) => HeldDecision | Promise<HeldDecision>,
) {
  let committed = 0;
  let allocated = 0;
  let released = 0;
  const failures: { id: string; key: string; reason: string }[] = [];
  for (const item of await port.listHeld(shop)) {
    const decision = await decide(item);
    if (decision === "ignore") continue;
    const valid = item.kind === "quota"
      ? decision === "commit" || decision === "release"
      : decision === "confirm" || decision === "release";
    const result = valid ? await port.apply(shop, item, decision) : { reason: "invalid_decision" };
    if ("reason" in result) failures.push({ id: item.id, key: item.key, reason: result.reason });
    else if (result.state === "committed") committed += 1;
    else if (result.state === "allocated") allocated += 1;
    else released += 1;
  }
  return { processed: committed + allocated + released, committed, allocated, released, failures };
}
