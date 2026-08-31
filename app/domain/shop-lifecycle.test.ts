import { describe, expect, it } from "vitest";
import {
  applyRelationshipEvent,
  isOperationalRelationship,
} from "./shop-lifecycle";
import type { RelationshipEvent } from "./shop-lifecycle";

const relationshipEvent = (
  type: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED",
  occurredAt: number,
  externalId: string,
): RelationshipEvent => ({ type, occurredAt, externalId });

describe("applyRelationshipEvent", () => {
  it("records an install as the first relationship state", () => {
    expect(applyRelationshipEvent(null, relationshipEvent("INSTALLED", 100, "event-1"))).toEqual({
      kind: "installed",
      occurredAt: 100,
      externalId: "event-1",
    });
  });

  it("leaves the projection unchanged for a duplicate event", () => {
    const current = applyRelationshipEvent(
      null,
      relationshipEvent("INSTALLED", 100, "event-1"),
    );

    expect(
      applyRelationshipEvent(current, relationshipEvent("INSTALLED", 100, "event-1")),
    ).toBe(current);
  });

  it("leaves the projection unchanged for an older event", () => {
    const current = applyRelationshipEvent(
      null,
      relationshipEvent("INSTALLED", 200, "event-2"),
    );

    expect(
      applyRelationshipEvent(current, relationshipEvent("UNINSTALLED", 100, "event-3")),
    ).toBe(current);
  });

  it("uses the external ID to reject a stale event at the same occurrence time", () => {
    const current = applyRelationshipEvent(
      null,
      relationshipEvent("INSTALLED", 100, "event-b"),
    );

    expect(
      applyRelationshipEvent(current, relationshipEvent("UNINSTALLED", 100, "event-a")),
    ).toBe(current);
  });

  it("uses a later external ID to apply an event at the same occurrence time", () => {
    const current = applyRelationshipEvent(
      null,
      relationshipEvent("INSTALLED", 100, "event-a"),
    );

    expect(
      applyRelationshipEvent(current, relationshipEvent("UNINSTALLED", 100, "event-b")),
    ).toEqual({ kind: "uninstalled", occurredAt: 100, externalId: "event-b" });
  });

  it("records an install after uninstall as a reinstall", () => {
    const uninstalled = applyRelationshipEvent(
      null,
      relationshipEvent("UNINSTALLED", 100, "event-1"),
    );

    expect(
      applyRelationshipEvent(uninstalled, relationshipEvent("INSTALLED", 200, "event-2")),
    ).toEqual({ kind: "installed", occurredAt: 200, externalId: "event-2" });
  });

  it("records an uninstall", () => {
    const installed = applyRelationshipEvent(null, relationshipEvent("INSTALLED", 100, "event-1"));

    expect(
      applyRelationshipEvent(installed, relationshipEvent("UNINSTALLED", 200, "event-2")),
    ).toEqual({ kind: "uninstalled", occurredAt: 200, externalId: "event-2" });
  });

  it("records a deactivation", () => {
    const installed = applyRelationshipEvent(null, relationshipEvent("INSTALLED", 100, "event-1"));

    expect(
      applyRelationshipEvent(installed, relationshipEvent("DEACTIVATED", 200, "event-2")),
    ).toEqual({ kind: "deactivated", occurredAt: 200, externalId: "event-2" });
  });

  it("records a reactivation", () => {
    const deactivated = applyRelationshipEvent(
      null,
      relationshipEvent("DEACTIVATED", 100, "event-1"),
    );

    expect(
      applyRelationshipEvent(deactivated, relationshipEvent("REACTIVATED", 200, "event-2")),
    ).toEqual({ kind: "reactivated", occurredAt: 200, externalId: "event-2" });
  });
});

describe("isOperationalRelationship", () => {
  it("accepts installed and reactivated relationships only", () => {
    const at = 100;

    expect(isOperationalRelationship({ kind: "installed", occurredAt: at, externalId: "a" })).toBe(
      true,
    );
    expect(isOperationalRelationship({ kind: "reactivated", occurredAt: at, externalId: "b" })).toBe(
      true,
    );
    expect(isOperationalRelationship({ kind: "uninstalled", occurredAt: at, externalId: "c" })).toBe(
      false,
    );
    expect(isOperationalRelationship({ kind: "deactivated", occurredAt: at, externalId: "d" })).toBe(
      false,
    );
    expect(isOperationalRelationship(null)).toBe(false);
  });
});
