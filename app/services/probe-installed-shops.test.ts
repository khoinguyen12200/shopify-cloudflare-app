import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeRedaction, noRedaction } from "~/test/redaction";
import { FakeTokenRefresher } from "~/test/fake-token-refresh";
import type { TokenRefreshOutcome } from "~/ports/token-refresh";
import { PROBE_BATCH_SIZE, PROBE_COOLDOWN_MS, PROBE_LEASE_MS, probeInstalledShops, type ProbePorts } from "./probe-installed-shops";

afterEach(() => vi.restoreAllMocks());

function fixture(options: { due: readonly string[]; outcomes?: Record<string, TokenRefreshOutcome | Error>; leased?: readonly string[]; uninstall?: "recorded" | "ignored_stale" }) {
  const events: string[] = [];
  const released: Record<string, unknown> = {};
  let now = 1_000;
  const refresher = new FakeTokenRefresher(options.outcomes ?? {});
  const ports: ProbePorts = {
    probes: {
      listDue: async (at, cooldown, limit) => { events.push(`due:${at}:${cooldown}:${limit}`); return options.due; },
      acquireLease: async (shop, _at, leaseMs) => { events.push(`lease:${shop}:${leaseMs}`); return !(options.leased ?? []).includes(shop); },
      release: async (shop, result) => { events.push(`release:${shop}`); released[shop] = result; },
    },
    refresher,
    uninstall: async (shop, observation) => { events.push(`uninstall:${shop}@${observation.occurredAt}:${observation.externalId}`); return options.uninstall ?? "recorded"; },
    clock: { now: () => (now += 10) },
    redaction: noRedaction,
  };
  return { ports, events, released, refresher };
}

describe("probeInstalledShops and redaction", () => {
  it("skips a tombstoned shop entirely: no lease, no Shopify call, counted as suppressed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, events, refresher } = fixture({ due: ["gone.myshopify.com", "live.myshopify.com"] });
    const summary = await probeInstalledShops({ ...ports, redaction: fakeRedaction(["gone.myshopify.com"]).guard }, 5_000);
    expect(summary).toMatchObject({ examined: 2, suppressed: 1, refreshed: 1 });
    expect(events.some((event) => event.includes("gone.myshopify.com"))).toBe(false);
    expect(refresher.calls.map((call) => call.shop)).toEqual(["live.myshopify.com"]);
  });
});

describe("probeInstalledShops", () => {
  it("asks for one bounded batch of due shops, once, and never more than the cap", async () => {
    const { ports, events } = fixture({ due: [] });
    await expect(probeInstalledShops(ports, 5_000)).resolves.toMatchObject({ examined: 0 });
    expect(events).toEqual([`due:5000:${PROBE_COOLDOWN_MS}:${PROBE_BATCH_SIZE}`]);
    expect(PROBE_BATCH_SIZE).toBeLessThanOrEqual(100);
  });

  it("probes one shop at a time, under a lease each, releasing it as a success", async () => {
    const { ports, events, released, refresher } = fixture({ due: ["a.myshopify.com", "b.myshopify.com"] });
    const summary = await probeInstalledShops(ports, 5_000);
    expect(summary).toMatchObject({ examined: 2, refreshed: 2, uninstalled: 0, failed: 0 });
    expect(refresher.maxConcurrent).toBe(1);
    expect(events.filter((event) => event.startsWith("lease") || event.startsWith("release"))).toEqual([
      `lease:a.myshopify.com:${PROBE_LEASE_MS}`, "release:a.myshopify.com", `lease:b.myshopify.com:${PROBE_LEASE_MS}`, "release:b.myshopify.com",
    ]);
    expect(released["a.myshopify.com"]).toMatchObject({ succeeded: true });
  });

  it("skips a shop whose lease is held, without calling Shopify for it", async () => {
    const { ports, refresher } = fixture({ due: ["a.myshopify.com", "b.myshopify.com"], leased: ["a.myshopify.com"] });
    const summary = await probeInstalledShops(ports, 5_000);
    expect(summary).toMatchObject({ examined: 2, leased: 1, refreshed: 1 });
    expect(refresher.calls.map((call) => call.shop)).toEqual(["b.myshopify.com"]);
  });

  it("treats a terminal rejection as an uninstall dated BEFORE the call, through the ordering-safe use case", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, events, refresher } = fixture({ due: ["gone.myshopify.com"], outcomes: { "gone.myshopify.com": { kind: "terminal" } } });
    const summary = await probeInstalledShops(ports, 5_000);
    const started = refresher.calls[0]?.now;
    expect(summary).toMatchObject({ uninstalled: 1 });
    expect(events).toContain(`uninstall:gone.myshopify.com@${started}:token_refresh_rejected:${started}`);
  });

  it("does not count an uninstall that the ordering rule refused (a newer reinstall) as an uninstall", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports } = fixture({ due: ["back.myshopify.com"], outcomes: { "back.myshopify.com": { kind: "terminal" } }, uninstall: "ignored_stale" });
    await expect(probeInstalledShops(ports, 5_000)).resolves.toMatchObject({ uninstalled: 0, superseded: 1 });
  });

  it.each([
    [{ kind: "transient", detail: "http_503" } as const, "transient"],
    [{ kind: "unexpected", detail: "http_400" } as const, "unexpected"],
  ])("never reads %j as an uninstall: it leaves the shop installed and records a failed attempt", async (outcome, code) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, events, released } = fixture({ due: ["flaky.myshopify.com"], outcomes: { "flaky.myshopify.com": outcome } });
    await expect(probeInstalledShops(ports, 5_000)).resolves.toMatchObject({ failed: 1, uninstalled: 0 });
    expect(events.some((event) => event.startsWith("uninstall"))).toBe(false);
    expect(released["flaky.myshopify.com"]).toMatchObject({ succeeded: false, code, detail: outcome.detail });
  });

  it("a storage failure while refreshing is a failed attempt for that shop and the batch carries on", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, released, refresher } = fixture({ due: ["bad.myshopify.com", "good.myshopify.com"], outcomes: { "bad.myshopify.com": new Error("kv down") } });
    const summary = await probeInstalledShops(ports, 5_000);
    expect(summary).toMatchObject({ failed: 1, refreshed: 1 });
    expect(released["bad.myshopify.com"]).toMatchObject({ succeeded: false, detail: "kv down" });
    expect(refresher.calls).toHaveLength(2);
  });

  it("releases the lease and carries on when recording the uninstall itself fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, released } = fixture({ due: ["x.myshopify.com", "y.myshopify.com"], outcomes: { "x.myshopify.com": { kind: "terminal" } } });
    const failing: ProbePorts = { ...ports, uninstall: async () => { throw new Error("d1 down"); } };
    const summary = await probeInstalledShops(failing, 5_000);
    expect(summary).toMatchObject({ failed: 1, refreshed: 1 });
    expect(released["x.myshopify.com"]).toMatchObject({ succeeded: false, code: "settle_failed" });
    expect(released["y.myshopify.com"]).toMatchObject({ succeeded: true });
  });

  it.each([
    [{ kind: "fresh" } as const, { fresh: 1 }],
    [{ kind: "no_session" } as const, { noSession: 1 }],
    [{ kind: "superseded" } as const, { superseded: 1 }],
  ])("counts %j as checked, not failed", async (outcome, expected) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { ports, released } = fixture({ due: ["s.myshopify.com"], outcomes: { "s.myshopify.com": outcome } });
    await expect(probeInstalledShops(ports, 5_000)).resolves.toMatchObject({ ...expected, failed: 0 });
    expect(released["s.myshopify.com"]).toMatchObject({ succeeded: true });
  });
});
