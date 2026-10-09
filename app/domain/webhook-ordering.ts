import {
  applyRelationshipEvent,
  type RelationshipEventType,
  type RelationshipState,
} from "~/domain/shop-lifecycle";

/**
 * Shopify does not guarantee webhook ordering and retries for hours
 * (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), so a delivery that reaches the consumer is a
 * statement about the moment Shopify triggered it — not about now. These are the pure decisions that compare that
 * moment with what the app already knows. No I/O, no clock: both times are arguments.
 */

/** The columns of a `shops` row that say what the app currently believes about the relationship. */
export interface ShopRelationshipFacts {
  readonly relationshipStatus: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED" | null;
  readonly relationshipOccurredAt: number | null;
  readonly relationshipExternalId: string | null;
  readonly installedAt: number;
  readonly currentInstalledAt: number | null;
  readonly uninstalledAt: number | null;
}

const kindByStatus: Readonly<Record<NonNullable<ShopRelationshipFacts["relationshipStatus"]>, RelationshipState["kind"]>> = {
  INSTALLED: "installed",
  UNINSTALLED: "uninstalled",
  DEACTIVATED: "deactivated",
  REACTIVATED: "reactivated",
};

/**
 * The relationship the `shops` row currently projects. A row that predates lifecycle tracking has no status; it is
 * read as installed unless it carries an uninstall time, anchored at the best timestamp it has.
 */
export function relationshipOf(facts: ShopRelationshipFacts): RelationshipState {
  const externalId = facts.relationshipExternalId ?? "";
  if (facts.relationshipStatus !== null) {
    const occurredAt = facts.relationshipOccurredAt ?? facts.uninstalledAt ?? facts.currentInstalledAt ?? facts.installedAt;
    return { kind: kindByStatus[facts.relationshipStatus], occurredAt, externalId };
  }
  if (facts.uninstalledAt !== null) return { kind: "uninstalled", occurredAt: facts.uninstalledAt, externalId };
  return { kind: "installed", occurredAt: facts.currentInstalledAt ?? facts.installedAt, externalId };
}

/** When an uninstall is known to have happened, and a stable key that breaks ties with other lifecycle facts. */
export interface UninstallObservation {
  /** Epoch ms at which Shopify triggered the uninstall (or, for a probe, when the probe started). */
  readonly occurredAt: number;
  readonly externalId: string;
}

export type UninstallDecision =
  /** The uninstall is the newest fact: record it, then clean up. */
  | { readonly outcome: "apply"; readonly next: RelationshipState }
  /** Already uninstalled: nothing to record, but cleanup is idempotent and a failed earlier attempt may owe it. */
  | { readonly outcome: "cleanup_only" }
  /** Older than what the app knows (a reinstall, typically), or about a shop it has no record of. Do nothing. */
  | { readonly outcome: "ignore"; readonly reason: "stale_uninstall" | "unknown_shop" };

const UNINSTALLED: RelationshipEventType = "UNINSTALLED";

/**
 * An uninstall delivered after a reinstall must not undo the reinstall. "After" is decided by the time Shopify
 * triggered the uninstall against the time the current relationship began — the same ordering key
 * (`occurredAt`, then `externalId`) the rest of the lifecycle uses, so there is one definition of "newer".
 */
export function decideUninstall(current: RelationshipState | null, observation: UninstallObservation): UninstallDecision {
  if (current === null) return { outcome: "ignore", reason: "unknown_shop" };
  const next = applyRelationshipEvent(current, { type: UNINSTALLED, ...observation });
  if (next !== current) return { outcome: "apply", next };
  return current.kind === "uninstalled" ? { outcome: "cleanup_only" } : { outcome: "ignore", reason: "stale_uninstall" };
}

export type ScopesUpdateDecision =
  | { readonly outcome: "apply" }
  | { readonly outcome: "ignore"; readonly reason: "unknown_shop" | "stale_scopes_update" };

/**
 * `app/scopes_update` carries the COMPLETE current scope set, so applying an old one after a newer one silently
 * revokes scopes the shop has. Apply only when no already-applied scope change is newer than this delivery's
 * trigger time. A change at exactly the same instant is not newer: Shopify's header has one-second resolution, so
 * ties are applied in arrival order rather than dropped. A shop that is currently uninstalled still takes the update:
 * dropping a genuine change because a reinstall has not yet been observed would be worse than recording scopes for a
 * shop with no sessions.
 */
export function decideScopesUpdate(input: {
  readonly relationship: RelationshipState | null;
  readonly latestAppliedChangeAt: number | null;
  readonly triggeredAt: number;
}): ScopesUpdateDecision {
  if (input.relationship === null) return { outcome: "ignore", reason: "unknown_shop" };
  if (input.latestAppliedChangeAt !== null && input.latestAppliedChangeAt > input.triggeredAt) {
    return { outcome: "ignore", reason: "stale_scopes_update" };
  }
  return { outcome: "apply" };
}
