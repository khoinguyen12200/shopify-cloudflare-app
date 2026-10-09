import { env } from "cloudflare:test";
import { redactionGuard } from "~/wiring/redaction.server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopRepo } from "~/models/shops.server";
import { ShopTokenProbeRepo } from "~/models/shop-token-probes.server";
import { runWithRequestContext } from "~/request-context.server";
import { KVSessionStorage } from "~/session-storage.server";
import { setupTestDatabase } from "~/test/db";
import { offlineSession } from "~/test/factories";
import { FakeTokenRefresher } from "~/test/fake-token-refresh";
import { probeInstalledShops, type ProbePorts } from "./probe-installed-shops";
import { recordUninstall } from "./record-uninstall";
import { runScheduledSweeps } from "./scheduled.server";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const row = (shop: string) => inRequest(() => new ShopRepo().get(shop));
const sessionsOf = (shop: string) => inRequest(() => new KVSessionStorage(env.SESSION).findSessionsByShop(shop));

/** Real D1 and KV behind the use case, exactly as `wiring.server.ts` binds them; only Shopify is faked. */
function composed(refresher: FakeTokenRefresher, clock: () => number): ProbePorts {
  const sessions = new KVSessionStorage(env.SESSION);
  const repository = new ShopRepo();
  return {
    probes: new ShopTokenProbeRepo(),
    refresher,
    clock: { now: clock },
    redaction: redactionGuard(),
    uninstall: (shop, observation) => recordUninstall({
      shops: { facts: (domain) => repository.get(domain), applyUninstall: (domain, next) => repository.applyUninstall(domain, next) },
      cleanup: async (domain) => { await sessions.deleteSessions((await sessions.findSessionsByShop(domain)).map(({ id }) => id)); },
      reconcile: async () => ({ ok: true }),
    }, shop, observation),
  };
}

describe("uninstall reconciliation (real D1 + KV, fake Shopify)", () => {
  it("finds a missed uninstall: a terminal token rejection marks the shop uninstalled and drops its sessions", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "missed.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    const refresher = new FakeTokenRefresher({ [shop]: { kind: "terminal" } });

    const summary = await inRequest(() => probeInstalledShops(composed(refresher, () => 50_000), 50_000));

    expect(summary).toMatchObject({ examined: 1, uninstalled: 1 });
    expect(await row(shop)).toMatchObject({ relationshipStatus: "UNINSTALLED", currentInstalledAt: null });
    expect(await sessionsOf(shop)).toHaveLength(0);
  });

  it("a transient failure leaves the shop installed and is retried on a later tick", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "flaky.myshopify.com";
    await inRequest(async () => { await new ShopRepo().recordInstall(shop, 1_000); });
    const refresher = new FakeTokenRefresher({ [shop]: { kind: "transient", detail: "http_503" } });

    await inRequest(() => probeInstalledShops(composed(refresher, () => 50_000), 50_000));
    expect(await row(shop)).toMatchObject({ relationshipStatus: "INSTALLED" });

    const second = await inRequest(() => probeInstalledShops(composed(refresher, () => 60_000), 60_000));
    expect(second.examined).toBe(1);
    expect(refresher.calls).toHaveLength(2);
  });

  it("a reinstall that lands while the probe is on the wire wins: the rejected pair was not the current one", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "back.myshopify.com";
    await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1_000);
      await new KVSessionStorage(env.SESSION).storeSession(offlineSession(shop));
    });
    const refresher = new FakeTokenRefresher({ [shop]: { kind: "terminal" } }, async () => {
      await new ShopRepo().recordInstall(shop, 70_000);
    });
    const ticks = [60_000, 60_001, 60_002, 60_003, 60_004, 60_005];
    const clock = () => ticks.shift() ?? 99_999;

    const summary = await inRequest(() => probeInstalledShops(composed(refresher, clock), 60_000));

    expect(summary).toMatchObject({ uninstalled: 0, superseded: 1 });
    expect(await row(shop)).toMatchObject({ relationshipStatus: "INSTALLED", relationshipOccurredAt: 70_000 });
    expect(await sessionsOf(shop)).toHaveLength(1);
  });

  it("never probes an already-uninstalled shop, and is cooled down after a successful probe", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await inRequest(async () => {
      await new ShopRepo().recordInstall("live.myshopify.com", 1_000);
      await new ShopRepo().recordInstall("dead.myshopify.com", 1_000);
      await new ShopRepo().applyUninstall("dead.myshopify.com", { kind: "uninstalled", occurredAt: 2_000, externalId: "u" });
    });
    const refresher = new FakeTokenRefresher({});
    await inRequest(() => probeInstalledShops(composed(refresher, () => 50_000), 50_000));
    await inRequest(() => probeInstalledShops(composed(refresher, () => 60_000), 60_000));
    expect(refresher.calls.map((call) => call.shop)).toEqual(["live.myshopify.com"]);
  });

  it("is one entry in the cron: runScheduledSweeps calls it, and a probe that throws costs the other sweeps nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls: string[] = [];
    await runScheduledSweeps(1_000, {
      tokens: { deleteExpiredBefore: async () => { calls.push("tokens"); return 0; } },
      uploads: { listExpiredUploads: async () => [], deleteExpiredUploads: async () => 0, deleteUploadObjects: async () => undefined },
      history: { reconcile: async () => ({ status: "succeeded", pages: 0, events: 0 }) },
      uninstallProbe: { run: async () => { throw new Error("probe exploded"); } },
    });
    expect(calls).toEqual(["tokens"]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"sweep":"uninstall_reconciliation"'));
  });
});
