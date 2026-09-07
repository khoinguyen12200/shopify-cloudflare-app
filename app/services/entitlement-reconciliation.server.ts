export type HeldItem = { readonly kind: "quota" | "capacity"; readonly id: string; readonly shop: string };
export type HeldDecision = "commit" | "release" | "ignore";
export interface HeldReconciliationPort {
  listHeld(shop: string): Promise<readonly HeldItem[]>;
  apply(item: HeldItem, decision: Exclude<HeldDecision, "ignore">): Promise<{ readonly state: "committed" | "released" }>;
}

export async function reconcileHeld(
  shop: string,
  port: HeldReconciliationPort,
  decide: (item: HeldItem) => HeldDecision,
): Promise<{ readonly processed: number; readonly committed: number; readonly released: number }> {
  const items = await port.listHeld(shop);
  let committed = 0;
  let released = 0;
  for (const item of items) {
    const decision = decide(item);
    if (decision === "ignore") continue;
    const result = await port.apply(item, decision);
    if (result.state === "committed") committed += 1;
    else released += 1;
  }
  return { processed: committed + released, committed, released };
}
