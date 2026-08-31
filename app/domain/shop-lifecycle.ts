export type RelationshipEventType =
  | "INSTALLED"
  | "UNINSTALLED"
  | "DEACTIVATED"
  | "REACTIVATED";

export interface RelationshipEvent {
  readonly type: RelationshipEventType;
  /** Epoch milliseconds when Shopify says this relationship change occurred. */
  readonly occurredAt: number;
  /** Stable Shopify event ID; breaks occurrence-time ties deterministically. */
  readonly externalId: string;
}

interface RelationshipStateBase {
  readonly occurredAt: number;
  readonly externalId: string;
}

export type RelationshipState =
  | (RelationshipStateBase & { readonly kind: "installed" })
  | (RelationshipStateBase & { readonly kind: "uninstalled" })
  | (RelationshipStateBase & { readonly kind: "deactivated" })
  | (RelationshipStateBase & { readonly kind: "reactivated" });

type RelationshipTransition = (event: RelationshipEvent) => RelationshipState;

const relationshipTransitions: Record<RelationshipEventType, RelationshipTransition> = {
  INSTALLED: (event) => ({
    kind: "installed",
    occurredAt: event.occurredAt,
    externalId: event.externalId,
  }),
  UNINSTALLED: (event) => ({
    kind: "uninstalled",
    occurredAt: event.occurredAt,
    externalId: event.externalId,
  }),
  DEACTIVATED: (event) => ({
    kind: "deactivated",
    occurredAt: event.occurredAt,
    externalId: event.externalId,
  }),
  REACTIVATED: (event) => ({
    kind: "reactivated",
    occurredAt: event.occurredAt,
    externalId: event.externalId,
  }),
};

function isNewerRelationshipEvent(
  current: RelationshipState,
  event: RelationshipEvent,
): boolean {
  if (event.occurredAt !== current.occurredAt) return event.occurredAt > current.occurredAt;
  return event.externalId > current.externalId;
}

/**
 * Applies authoritative relationship facts in Shopify's deterministic event
 * order. Duplicate and stale facts preserve the current projection exactly.
 */
export function applyRelationshipEvent(
  current: RelationshipState | null,
  event: RelationshipEvent,
): RelationshipState {
  if (current !== null && !isNewerRelationshipEvent(current, event)) return current;
  return relationshipTransitions[event.type](event);
}

export function isOperationalRelationship(state: RelationshipState | null): boolean {
  return state?.kind === "installed" || state?.kind === "reactivated";
}
