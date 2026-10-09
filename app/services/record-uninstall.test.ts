import { afterEach, describe, expect, it, vi } from "vitest";
import type { RelationshipState } from "~/domain/shop-lifecycle";
import type { ShopRelationshipFacts } from "~/domain/webhook-ordering";
import { recordUninstall, type RecordUninstallPorts } from "./record-uninstall";

const SHOP = "fake.myshopify.com";

const installedAt = (at: number): ShopRelationshipFacts => ({
  relationshipStatus: "INSTALLED", relationshipOccurredAt: at, relationshipExternalId: `install:${at}`,
  installedAt: at, currentInstalledAt: at, uninstalledAt: null,
});
const uninstalledAt = (at: number): ShopRelationshipFacts => ({
  relationshipStatus: "UNINSTALLED", relationshipOccurredAt: at, relationshipExternalId: `webhook:${at}`,
  installedAt: 1, currentInstalledAt: null, uninstalledAt: at,
});

function fakePorts(facts: ShopRelationshipFacts | undefined, write: "applied" | "stale" = "applied") {
  const calls: string[] = [];
  const written: RelationshipState[] = [];
  const ports: RecordUninstallPorts = {
    shops: {
      facts: async () => facts,
      applyUninstall: async (_shop, next) => { calls.push("write"); written.push(next); return write; },
    },
    cleanup: async () => { calls.push("cleanup"); },
    reconcile: async () => { calls.push("reconcile"); return { ok: true }; },
  };
  return { ports, calls, written };
}

afterEach(() => vi.restoreAllMocks());

describe("recordUninstall", () => {
  it("records, cleans up and reconciles, in that order, for an in-order uninstall", async () => {
    const { ports, calls, written } = fakePorts(installedAt(1_000));
    await expect(recordUninstall(ports, SHOP, { occurredAt: 2_000, externalId: "webhook:a" })).resolves.toBe("recorded");
    expect(calls).toEqual(["write", "cleanup", "reconcile"]);
    expect(written).toEqual([{ kind: "uninstalled", occurredAt: 2_000, externalId: "webhook:a" }]);
  });

  it("does nothing at all for an uninstall older than the current install", async () => {
    const { ports, calls } = fakePorts(installedAt(5_000));
    await expect(recordUninstall(ports, SHOP, { occurredAt: 2_000, externalId: "webhook:a" })).resolves.toBe("ignored_stale");
    expect(calls).toEqual([]);
  });

  it("does nothing for a shop it has no record of", async () => {
    const { ports, calls } = fakePorts(undefined);
    await expect(recordUninstall(ports, SHOP, { occurredAt: 2_000, externalId: "webhook:a" })).resolves.toBe("ignored_unknown_shop");
    expect(calls).toEqual([]);
  });

  it("does not clean up when a reinstall wins the race between the read and the write", async () => {
    const { ports, calls } = fakePorts(installedAt(1_000), "stale");
    await expect(recordUninstall(ports, SHOP, { occurredAt: 2_000, externalId: "webhook:a" })).resolves.toBe("ignored_stale");
    expect(calls).toEqual(["write"]);
  });

  it("finishes cleanup without rewriting when a retry finds the shop already uninstalled", async () => {
    const { ports, calls } = fakePorts(uninstalledAt(2_000));
    await expect(recordUninstall(ports, SHOP, { occurredAt: 2_000, externalId: "webhook:2000" })).resolves.toBe("already_uninstalled");
    expect(calls).toEqual(["cleanup", "reconcile"]);
  });

  it("logs a failed reconciliation by shop hash but still reports the uninstall as recorded", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports } = fakePorts(installedAt(1_000));
    const failing: RecordUninstallPorts = { ...ports, reconcile: async () => ({ ok: false, code: "BOOM", detail: "partner down" }) };
    await expect(recordUninstall(failing, SHOP, { occurredAt: 2_000, externalId: "webhook:a" })).resolves.toBe("recorded");
    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("shopify.uninstall.reconciliation_failed");
    expect(output).toContain("BOOM");
    expect(output).not.toContain(SHOP);
  });
});
