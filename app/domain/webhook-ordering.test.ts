import { describe, expect, it } from "vitest";
import type { RelationshipState } from "./shop-lifecycle";
import { decideScopesUpdate, decideUninstall, relationshipOf, type ShopRelationshipFacts } from "./webhook-ordering";

const installed = (occurredAt: number, externalId = "install:x"): RelationshipState => ({ kind: "installed", occurredAt, externalId });

describe("relationshipOf", () => {
  const facts = (overrides: Partial<ShopRelationshipFacts>): ShopRelationshipFacts => ({
    relationshipStatus: null, relationshipOccurredAt: null, relationshipExternalId: null,
    installedAt: 10, currentInstalledAt: null, uninstalledAt: null, ...overrides,
  });

  it.each([
    ["INSTALLED", "installed"], ["UNINSTALLED", "uninstalled"], ["DEACTIVATED", "deactivated"], ["REACTIVATED", "reactivated"],
  ] as const)("maps the %s status to the %s state with its ordering key", (status, kind) => {
    expect(relationshipOf(facts({ relationshipStatus: status, relationshipOccurredAt: 50, relationshipExternalId: "id" })))
      .toEqual({ kind, occurredAt: 50, externalId: "id" });
  });

  it("falls back to the best timestamp the row has when the ordering key is missing", () => {
    expect(relationshipOf(facts({ relationshipStatus: "INSTALLED", currentInstalledAt: 30 }))).toEqual({ kind: "installed", occurredAt: 30, externalId: "" });
    expect(relationshipOf(facts({ relationshipStatus: "UNINSTALLED", uninstalledAt: 40, currentInstalledAt: 30 }))).toEqual({ kind: "uninstalled", occurredAt: 40, externalId: "" });
    expect(relationshipOf(facts({ relationshipStatus: "INSTALLED" }))).toEqual({ kind: "installed", occurredAt: 10, externalId: "" });
  });

  it("reads a legacy row with no status as installed, or uninstalled when it carries an uninstall time", () => {
    expect(relationshipOf(facts({ currentInstalledAt: 30 }))).toEqual({ kind: "installed", occurredAt: 30, externalId: "" });
    expect(relationshipOf(facts({}))).toEqual({ kind: "installed", occurredAt: 10, externalId: "" });
    expect(relationshipOf(facts({ uninstalledAt: 60 }))).toEqual({ kind: "uninstalled", occurredAt: 60, externalId: "" });
  });
});

describe("decideUninstall", () => {
  it("records an uninstall newer than the current install", () => {
    expect(decideUninstall(installed(1_000), { occurredAt: 2_000, externalId: "webhook:a" })).toEqual({
      outcome: "apply", next: { kind: "uninstalled", occurredAt: 2_000, externalId: "webhook:a" },
    });
  });

  it("ignores an uninstall triggered before the shop reinstalled", () => {
    expect(decideUninstall(installed(5_000), { occurredAt: 2_000, externalId: "webhook:a" })).toEqual({ outcome: "ignore", reason: "stale_uninstall" });
  });

  it.each(["installed", "reactivated", "deactivated"] as const)("ignores a stale uninstall against a %s relationship", (kind) => {
    expect(decideUninstall({ kind, occurredAt: 5_000, externalId: "z" }, { occurredAt: 4_999, externalId: "webhook:a" }))
      .toEqual({ outcome: "ignore", reason: "stale_uninstall" });
  });

  it("applies an uninstall after a reactivation, a deactivation or an install that is older", () => {
    for (const kind of ["installed", "reactivated", "deactivated"] as const) {
      expect(decideUninstall({ kind, occurredAt: 1, externalId: "a" }, { occurredAt: 2, externalId: "b" }).outcome).toBe("apply");
    }
  });

  it("breaks an exact tie with the same key the lifecycle uses: the larger external id is newer", () => {
    expect(decideUninstall(installed(1_000, "install:1000"), { occurredAt: 1_000, externalId: "uninstall:1000" }).outcome).toBe("apply");
    expect(decideUninstall(installed(1_000, "zzz"), { occurredAt: 1_000, externalId: "aaa" })).toEqual({ outcome: "ignore", reason: "stale_uninstall" });
  });

  it("asks only for idempotent cleanup when the shop is already uninstalled, whether the delivery is newer, older or identical", () => {
    const uninstalled: RelationshipState = { kind: "uninstalled", occurredAt: 2_000, externalId: "webhook:a" };
    expect(decideUninstall(uninstalled, { occurredAt: 2_000, externalId: "webhook:a" })).toEqual({ outcome: "cleanup_only" });
    expect(decideUninstall(uninstalled, { occurredAt: 1_000, externalId: "webhook:b" })).toEqual({ outcome: "cleanup_only" });
  });

  it("ignores an uninstall for a shop it has no record of", () => {
    expect(decideUninstall(null, { occurredAt: 1, externalId: "a" })).toEqual({ outcome: "ignore", reason: "unknown_shop" });
  });

  it("does not mutate the current state", () => {
    const current = installed(1_000);
    decideUninstall(current, { occurredAt: 2_000, externalId: "b" });
    expect(current).toEqual(installed(1_000));
  });
});

describe("decideScopesUpdate", () => {
  const input = { relationship: installed(1), latestAppliedChangeAt: null, triggeredAt: 500 };

  it("applies when nothing newer has been applied", () => {
    expect(decideScopesUpdate(input)).toEqual({ outcome: "apply" });
    expect(decideScopesUpdate({ ...input, latestAppliedChangeAt: 499 })).toEqual({ outcome: "apply" });
  });

  it("applies at an exact tie, because the header resolves to one second and dropping would lose a change", () => {
    expect(decideScopesUpdate({ ...input, latestAppliedChangeAt: 500 })).toEqual({ outcome: "apply" });
  });

  it("drops a delivery older than a change already applied, so it cannot revert the newer scope set", () => {
    expect(decideScopesUpdate({ ...input, latestAppliedChangeAt: 501 })).toEqual({ outcome: "ignore", reason: "stale_scopes_update" });
  });

  it("ignores an update for a shop it has no record of", () => {
    expect(decideScopesUpdate({ ...input, relationship: null })).toEqual({ outcome: "ignore", reason: "unknown_shop" });
  });

  it("still applies to a currently uninstalled shop rather than dropping a genuine change", () => {
    expect(decideScopesUpdate({ ...input, relationship: { kind: "uninstalled", occurredAt: 9, externalId: "u" } })).toEqual({ outcome: "apply" });
  });
});
