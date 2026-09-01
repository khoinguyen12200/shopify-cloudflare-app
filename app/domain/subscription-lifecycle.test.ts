import { describe, expect, it } from "vitest";
import {
  applySubscriptionObservation,
  isPaidSubscription,
} from "./subscription-lifecycle";
import type {
  SubscriptionObservation,
  SubscriptionState,
  SubscriptionStatus,
} from "./subscription-lifecycle";

type ActiveStatusCase = readonly [SubscriptionStatus, SubscriptionState["kind"]];

const activeStatusCases: readonly ActiveStatusCase[] = [
  ["NONE", "none"],
  ["PENDING", "pending"],
  ["ACTIVE", "active"],
  ["CANCELLATION_SCHEDULED", "cancellation_scheduled"],
  ["FROZEN", "frozen"],
  ["CANCELED", "canceled"],
  ["UNKNOWN", "unknown"],
];

const historicalObservation = (
  type: "CANCELLATION_SCHEDULED" | "FROZEN" | "CANCELED",
  occurredAt: number,
  externalId: string,
): SubscriptionObservation => ({ type, occurredAt, externalId });

const statusObservation = (
  type: "CREATED" | "UPDATED",
  status: SubscriptionStatus,
  occurredAt: number,
  externalId: string,
): SubscriptionObservation => ({ type, status, occurredAt, externalId });

const unfrozenObservation = (occurredAt: number, externalId: string): SubscriptionObservation => ({
  type: "UNFROZEN",
  occurredAt,
  externalId,
});

const activeSubscriptionObservation = (
  status: SubscriptionStatus,
  occurredAt: number,
  externalId: string,
): SubscriptionObservation => ({ type: "ACTIVE_SUBSCRIPTION", status, occurredAt, externalId });

describe("applySubscriptionObservation", () => {
  it("records the status observed when a subscription is created", () => {
    expect(
      applySubscriptionObservation(null, statusObservation("CREATED", "ACTIVE", 100, "event-1")),
    ).toEqual({ kind: "active", occurredAt: 100, externalId: "event-1" });
  });

  it("records the status observed when a subscription is updated", () => {
    const active = applySubscriptionObservation(
      null,
      activeSubscriptionObservation("ACTIVE", 100, "subscription-1"),
    );

    expect(
      applySubscriptionObservation(
        active,
        statusObservation("UPDATED", "CANCELLATION_SCHEDULED", 200, "event-2"),
      ),
    ).toEqual({ kind: "cancellation_scheduled", occurredAt: 200, externalId: "event-2" });
  });

  it("restores a frozen subscription to an active paid state when it is unfrozen", () => {
    const frozen = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 100, "event-1"),
    );

    const restored = applySubscriptionObservation(frozen, unfrozenObservation(200, "event-2"));

    expect(restored).toEqual({ kind: "active", occurredAt: 200, externalId: "event-2" });
    expect(isPaidSubscription(restored)).toBe(true);
  });

  it("records a cancellation-scheduled observation", () => {
    expect(
      applySubscriptionObservation(
        null,
        historicalObservation("CANCELLATION_SCHEDULED", 100, "event-1"),
      ),
    ).toEqual({ kind: "cancellation_scheduled", occurredAt: 100, externalId: "event-1" });
  });

  it("leaves the projection unchanged for a duplicate observation", () => {
    const current = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 100, "event-1"),
    );

    expect(
      applySubscriptionObservation(current, historicalObservation("FROZEN", 100, "event-1")),
    ).toBe(current);
  });

  it("leaves the projection unchanged for a stale observation", () => {
    const current = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 200, "event-2"),
    );

    expect(
      applySubscriptionObservation(current, historicalObservation("CANCELED", 100, "event-3")),
    ).toBe(current);
  });

  it("uses the external ID to reject a stale observation at the same occurrence time", () => {
    const current = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 100, "event-b"),
    );

    expect(
      applySubscriptionObservation(current, historicalObservation("CANCELED", 100, "event-a")),
    ).toBe(current);
  });

  it("uses a later external ID to apply an observation at the same occurrence time", () => {
    const current = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 100, "event-a"),
    );

    expect(
      applySubscriptionObservation(current, historicalObservation("CANCELED", 100, "event-b")),
    ).toEqual({ kind: "canceled", occurredAt: 100, externalId: "event-b" });
  });

  it("records a frozen subscription", () => {
    const active = applySubscriptionObservation(
      null,
      activeSubscriptionObservation("ACTIVE", 100, "subscription-1"),
    );

    expect(
      applySubscriptionObservation(active, historicalObservation("FROZEN", 200, "event-2")),
    ).toEqual({ kind: "frozen", occurredAt: 200, externalId: "event-2" });
  });

  it("records a canceled subscription", () => {
    const frozen = applySubscriptionObservation(
      null,
      historicalObservation("FROZEN", 100, "event-1"),
    );

    expect(
      applySubscriptionObservation(frozen, historicalObservation("CANCELED", 200, "event-2")),
    ).toEqual({ kind: "canceled", occurredAt: 200, externalId: "event-2" });
  });

  it("accepts an Active Subscription observation as the authoritative current state", () => {
    const canceled = applySubscriptionObservation(
      null,
      historicalObservation("CANCELED", 100, "event-1"),
    );

    expect(
      applySubscriptionObservation(
        canceled,
        activeSubscriptionObservation("ACTIVE", 200, "subscription-1"),
      ),
    ).toEqual({ kind: "active", occurredAt: 200, externalId: "subscription-1" });
  });

  it.each(activeStatusCases)("maps an Active Subscription %s observation to %s", (status, kind) => {
    expect(applySubscriptionObservation(null, activeSubscriptionObservation(status, 100, "sub-1"))).toEqual({
      kind,
      occurredAt: 100,
      externalId: "sub-1",
    });
  });
});

describe("isPaidSubscription", () => {
  it("accepts active and cancellation-scheduled subscriptions only", () => {
    const at = 100;

    expect(isPaidSubscription({ kind: "active", occurredAt: at, externalId: "a" })).toBe(true);
    expect(
      isPaidSubscription({ kind: "cancellation_scheduled", occurredAt: at, externalId: "b" }),
    ).toBe(true);
    expect(isPaidSubscription({ kind: "none", occurredAt: at, externalId: "c" })).toBe(false);
    expect(isPaidSubscription({ kind: "pending", occurredAt: at, externalId: "d" })).toBe(false);
    expect(isPaidSubscription({ kind: "frozen", occurredAt: at, externalId: "e" })).toBe(false);
    expect(isPaidSubscription({ kind: "canceled", occurredAt: at, externalId: "f" })).toBe(false);
    expect(isPaidSubscription({ kind: "unknown", occurredAt: at, externalId: "g" })).toBe(false);
    expect(isPaidSubscription(null)).toBe(false);
  });
});
