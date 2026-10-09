import { EntitlementRepo } from "~/models/entitlements.server";
import type { HeldItem, HeldReconciliationPort } from "~/ports/entitlement-reconciliation";
import { appRuntime } from "~/wiring/runtime.server";

type HeldPosition = Pick<HeldItem, "createdAt" | "kind" | "key" | "id">;

function compareHeldPosition(left: HeldPosition, right: HeldPosition): number {
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  if (left.kind !== right.kind) return left.kind === "quota" ? -1 : 1;
  const keyOrder = left.key.localeCompare(right.key);
  if (keyOrder !== 0) return keyOrder;
  return left.id.localeCompare(right.id);
}

function encodeHeldCursor(item: HeldPosition): string {
  return encodeURIComponent(JSON.stringify(item));
}

function decodeHeldCursor(cursor: string | undefined): HeldPosition | undefined {
  if (cursor === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cursor));
    if (parsed === null || typeof parsed !== "object") return undefined;
    if (!("createdAt" in parsed) || !("kind" in parsed) || !("key" in parsed) || !("id" in parsed)) return undefined;
    return typeof parsed.createdAt === "number" && (parsed.kind === "quota" || parsed.kind === "capacity")
      && typeof parsed.key === "string" && typeof parsed.id === "string"
      ? { createdAt: parsed.createdAt, kind: parsed.kind, key: parsed.key, id: parsed.id }
      : undefined;
  } catch {
    return undefined;
  }
}

export function entitlementReconciliationPort(): HeldReconciliationPort {
  const repo = new EntitlementRepo(appRuntime().clock);
  return {
    async listHeld(shop, cursor, limit) {
      const quota = await repo.listHeld(shop);
      const capacity = await repo.listHeldAllocations(shop);
      const items: HeldItem[] = [
        ...quota.map((row): HeldItem => ({ kind: "quota", shop, key: row.key, id: row.operationId, period: row.period, amount: row.amount, createdAt: row.createdAt })),
        ...capacity.map((row): HeldItem => ({ kind: "capacity", shop, key: row.key, id: row.allocationId, operationId: row.operationId, createdAt: row.createdAt })),
      ].sort(compareHeldPosition);
      const position = decodeHeldCursor(cursor);
      if (cursor !== undefined && position === undefined) return { items: [], nextCursor: undefined };
      const afterCursor = position === undefined ? items : items.filter((item) => compareHeldPosition(item, position) > 0);
      const pageSize = limit === undefined ? afterCursor.length : Math.max(0, limit);
      const page = afterCursor.slice(0, pageSize);
      const last = page.at(-1);
      return {
        items: page,
        nextCursor: last !== undefined && afterCursor.length > page.length ? encodeHeldCursor(last) : undefined,
      };
    },
    apply: (shop, item, decision, actualAmount) => repo.applyReconciliation(shop, item, decision, actualAmount),
  };
}
