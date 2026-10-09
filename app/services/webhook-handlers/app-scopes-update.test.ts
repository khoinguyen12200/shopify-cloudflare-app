import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShopRelationshipFacts } from "~/domain/webhook-ordering";
import type { ConsumerDelivery } from "~/services/webhook-consumer";
import { appScopesUpdateHandler, type ScopesUpdatePorts } from "./app-scopes-update";

const delivery = (overrides: Partial<ConsumerDelivery> = {}): ConsumerDelivery => ({
  id: "d1", shop: "fake.myshopify.com", topic: "app/scopes_update", status: "processing", triggeredAt: 500, ...overrides,
});
const facts: ShopRelationshipFacts = {
  relationshipStatus: "INSTALLED", relationshipOccurredAt: 1, relationshipExternalId: "i", installedAt: 1, currentInstalledAt: 1, uninstalledAt: null,
};

function fakePorts(options: { facts?: ShopRelationshipFacts; latest?: number | null; scopes?: readonly string[]; applied?: "applied" | "duplicate" } = {}) {
  const calls: string[] = [];
  const ports: ScopesUpdatePorts = {
    shops: { facts: async () => ("facts" in options ? options.facts : facts) },
    scopes: {
      list: async () => options.scopes ?? ["read_products", "write_products"],
      latestChangeAt: async () => options.latest ?? null,
      applyScopes: async (_id, _shop, scopes, occurredAt) => { calls.push(`apply:${scopes.join("+")}@${occurredAt}`); return options.applied ?? "applied"; },
    },
    sessions: { updateScope: async (_shop, scope) => { calls.push(`sessions:${scope}`); } },
  };
  return { ports, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("appScopesUpdateHandler", () => {
  it("records the change at the delivery's trigger time, not the time the queue ran, then stamps the sessions", async () => {
    const { ports, calls } = fakePorts();
    await appScopesUpdateHandler(ports)(delivery({ triggeredAt: 500 }));
    expect(calls).toEqual(["apply:read_products+write_products@500", "sessions:read_products,write_products"]);
  });

  it("drops a delivery older than an applied change: no scope write and no session write", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, calls } = fakePorts({ latest: 900 });
    await appScopesUpdateHandler(ports)(delivery({ triggeredAt: 500 }));
    expect(calls).toEqual([]);
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).toContain("stale_scopes_update");
  });

  it("does nothing for a shop with no record", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, calls } = fakePorts({ facts: undefined });
    await appScopesUpdateHandler(ports)(delivery());
    expect(calls).toEqual([]);
  });

  it("still stamps the sessions when a retry finds the change already recorded", async () => {
    const { ports, calls } = fakePorts({ applied: "duplicate" });
    await appScopesUpdateHandler(ports)(delivery());
    expect(calls).toEqual(["apply:read_products+write_products@500", "sessions:read_products,write_products"]);
  });
});
