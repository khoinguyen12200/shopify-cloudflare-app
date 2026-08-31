export type SubscriptionStatus =
  | "NONE"
  | "PENDING"
  | "ACTIVE"
  | "CANCELLATION_SCHEDULED"
  | "FROZEN"
  | "CANCELED"
  | "UNKNOWN";

interface SubscriptionObservationBase {
  /** Epoch milliseconds when Shopify says this observation occurred. */
  readonly occurredAt: number;
  /** Stable event or subscription ID; breaks occurrence-time ties deterministically. */
  readonly externalId: string;
}

export type SubscriptionObservation =
  | (SubscriptionObservationBase & { readonly type: "CANCELLATION_SCHEDULED" })
  | (SubscriptionObservationBase & { readonly type: "FROZEN" })
  | (SubscriptionObservationBase & { readonly type: "CANCELED" })
  | (SubscriptionObservationBase & {
      readonly type: "ACTIVE_SUBSCRIPTION";
      readonly status: SubscriptionStatus;
    });

interface SubscriptionStateBase {
  readonly occurredAt: number;
  readonly externalId: string;
}

export type SubscriptionState =
  | (SubscriptionStateBase & { readonly kind: "none" })
  | (SubscriptionStateBase & { readonly kind: "pending" })
  | (SubscriptionStateBase & { readonly kind: "active" })
  | (SubscriptionStateBase & { readonly kind: "cancellation_scheduled" })
  | (SubscriptionStateBase & { readonly kind: "frozen" })
  | (SubscriptionStateBase & { readonly kind: "canceled" })
  | (SubscriptionStateBase & { readonly kind: "unknown" });

type HistoricalSubscriptionObservation = Exclude<
  SubscriptionObservation,
  { readonly type: "ACTIVE_SUBSCRIPTION" }
>;

type HistoricalTransition = (observation: HistoricalSubscriptionObservation) => SubscriptionState;
type ActiveSubscriptionTransition = (
  observation: Extract<SubscriptionObservation, { readonly type: "ACTIVE_SUBSCRIPTION" }>,
) => SubscriptionState;

const historicalTransitions: Record<
  HistoricalSubscriptionObservation["type"],
  HistoricalTransition
> = {
  CANCELLATION_SCHEDULED: (observation) => ({
    kind: "cancellation_scheduled",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  FROZEN: (observation) => ({
    kind: "frozen",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  CANCELED: (observation) => ({
    kind: "canceled",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
};

const activeSubscriptionTransitions: Record<SubscriptionStatus, ActiveSubscriptionTransition> = {
  NONE: (observation) => ({
    kind: "none",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  PENDING: (observation) => ({
    kind: "pending",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  ACTIVE: (observation) => ({
    kind: "active",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  CANCELLATION_SCHEDULED: (observation) => ({
    kind: "cancellation_scheduled",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  FROZEN: (observation) => ({
    kind: "frozen",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  CANCELED: (observation) => ({
    kind: "canceled",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
  UNKNOWN: (observation) => ({
    kind: "unknown",
    occurredAt: observation.occurredAt,
    externalId: observation.externalId,
  }),
};

function isNewerSubscriptionObservation(
  current: SubscriptionState,
  observation: SubscriptionObservation,
): boolean {
  if (observation.occurredAt !== current.occurredAt) {
    return observation.occurredAt > current.occurredAt;
  }
  return observation.externalId > current.externalId;
}

/**
 * Applies either a historical subscription event or an Active Subscription
 * read, keeping only Shopify's latest ordered observation in the projection.
 */
export function applySubscriptionObservation(
  current: SubscriptionState | null,
  observation: SubscriptionObservation,
): SubscriptionState {
  if (current !== null && !isNewerSubscriptionObservation(current, observation)) return current;
  if (observation.type === "ACTIVE_SUBSCRIPTION") {
    return activeSubscriptionTransitions[observation.status](observation);
  }
  return historicalTransitions[observation.type](observation);
}

export function isPaidSubscription(state: SubscriptionState | null): boolean {
  return state?.kind === "active" || state?.kind === "cancellation_scheduled";
}
