import { describe, it, expect } from "vitest";
import { orderChain, isDemoted, MODEL_RECOVERY_MS } from "./chain";

const NOW = 1_700_000_000_000;

const row = (over: Partial<Parameters<typeof orderChain>[0][number]> = {}) => ({
  modelId: "@cf/a/one",
  priority: 0,
  enabled: true,
  healthy: true,
  lastFailedAt: null,
  ...over,
});

describe("ordering a purpose's chain", () => {
  it("tries the lowest priority first", () => {
    const order = orderChain(
      [row({ modelId: "second", priority: 1 }), row({ modelId: "first", priority: 0 })],
      NOW,
    );
    expect(order).toEqual(["first", "second"]);
  });

  it("drops a model an admin has switched off", () => {
    // Parked deliberately — unlike a demotion, this one IS a removal.
    const order = orderChain(
      [row({ modelId: "off", priority: 0, enabled: false }), row({ modelId: "on", priority: 1 })],
      NOW,
    );
    expect(order).toEqual(["on"]);
  });

  it("DEMOTES a recently failed model to the back rather than dropping it", () => {
    // Dropping could empty a purpose entirely, and a degraded answer beats no
    // answer — the merchant asked either way.
    const order = orderChain(
      [
        row({ modelId: "sick", priority: 0, healthy: false, lastFailedAt: NOW - 1000 }),
        row({ modelId: "well", priority: 1 }),
      ],
      NOW,
    );
    expect(order).toEqual(["well", "sick"]);
  });

  it("keeps a demoted model as the only candidate when it is the only one", () => {
    const order = orderChain(
      [row({ modelId: "sick", healthy: false, lastFailedAt: NOW - 1000 })],
      NOW,
    );
    expect(order).toEqual(["sick"]);
  });

  it("trusts a failed model again once the recovery window passes", () => {
    const order = orderChain(
      [
        row({ modelId: "recovered", priority: 0, healthy: false, lastFailedAt: NOW - MODEL_RECOVERY_MS - 1 }),
        row({ modelId: "other", priority: 1 }),
      ],
      NOW,
    );
    expect(order).toEqual(["recovered", "other"]);
  });

  it("still demotes exactly at the edge of the window", () => {
    expect(isDemoted(row({ healthy: false, lastFailedAt: NOW - MODEL_RECOVERY_MS + 1 }), NOW)).toBe(true);
    expect(isDemoted(row({ healthy: false, lastFailedAt: NOW - MODEL_RECOVERY_MS }), NOW)).toBe(false);
  });

  it("does not demote a model marked unhealthy with no failure time", () => {
    // Nothing to measure a window from, so trust it rather than sideline it
    // forever.
    expect(isDemoted(row({ healthy: false, lastFailedAt: null }), NOW)).toBe(false);
  });

  it("preserves priority order within the healthy group and within the demoted group", () => {
    const order = orderChain(
      [
        row({ modelId: "sick-late", priority: 3, healthy: false, lastFailedAt: NOW }),
        row({ modelId: "well-late", priority: 2 }),
        row({ modelId: "sick-early", priority: 1, healthy: false, lastFailedAt: NOW }),
        row({ modelId: "well-early", priority: 0 }),
      ],
      NOW,
    );
    expect(order).toEqual(["well-early", "well-late", "sick-early", "sick-late"]);
  });

  it("is empty when a purpose has no models at all", () => {
    expect(orderChain([], NOW)).toEqual([]);
  });

  it("is empty when every model is switched off", () => {
    expect(orderChain([row({ enabled: false })], NOW)).toEqual([]);
  });
});
