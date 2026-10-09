import type { RedactionGuard } from "~/services/redaction-guard";
import { shopLog } from "~/observability/shop-log";
import type { ShopTokenRefresher, TokenRefreshOutcome } from "~/ports/token-refresh";
import type { UninstallObservation } from "~/domain/webhook-ordering";
import type { UninstallOutcome } from "~/services/record-uninstall";

/**
 * Shops probed per tick. Each probe is ONE external fetch (the token endpoint) plus a handful of KV/D1 calls, all
 * sequential. Workers Free allows 50 external subrequests per invocation (Paid: 10,000) and 1,000 to internal
 * services, so 40 leaves headroom under the Free cap for the other fetches a full daily tick makes. Capacity is
 * `PROBE_BATCH_SIZE x ticks per day`: with the hourly probe cron, 960 shops/day, and a fleet of up to
 * `PROBE_BATCH_SIZE x (PROBE_COOLDOWN_MS / 1h)` = 800 shops is covered inside one cooldown. See shopify-api-invariants.md.
 */
export const PROBE_BATCH_SIZE = 40;
/** A shop probed successfully inside this window is not probed again. */
export const PROBE_COOLDOWN_MS = 20 * 60 * 60 * 1000;
/** Longer than a probe can take, short enough that a crashed tick does not block the shop for long. */
export const PROBE_LEASE_MS = 2 * 60 * 1000;

export interface ProbePorts {
  readonly probes: {
    listDue(now: number, cooldownMs: number, limit: number): Promise<readonly string[]>;
    /** Shops due right now, beyond the batch: a count, so a growing backlog is visible without naming anyone. */
    countDue(now: number, cooldownMs: number): Promise<number>;
    acquireLease(shop: string, now: number, leaseMs: number): Promise<boolean>;
    release(shop: string, result: { readonly at: number } & ({ readonly succeeded: true } | { readonly succeeded: false; readonly code: string; readonly detail: string })): Promise<void>;
  };
  readonly refresher: ShopTokenRefresher;
  readonly uninstall: (shop: string, observation: UninstallObservation) => Promise<UninstallOutcome>;
  readonly clock: { now(): number };
  /** A shop with a redaction tombstone is never probed: a probe would write a checkpoint row naming it. */
  readonly redaction: Pick<RedactionGuard, "redactedAmong">;
}

type Disposition = "refreshed" | "fresh" | "noSession" | "superseded" | "uninstalled" | "failed" | "suppressed";

/** Counts for the cron log. A mapped type, so it is assignable to the port's `Record<string, number>`. */
export type ProbeSummary = { readonly [K in Disposition | "examined" | "leased" | "overdue"]: number };

/**
 * Reconciliation for a missed `app/uninstalled`. Shopify retries a webhook for four hours and then gives up, and
 * tells apps not to rely on webhooks alone (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), so a
 * shop that is uninstalled but still marked installed is found here: refresh its stored token pair, and a terminal
 * 401 `invalid_request` means the pair — and with it the installation — is gone.
 *
 * Bounded: at most `PROBE_BATCH_SIZE` shops per tick, least-recently-attempted first, so successive ticks walk the
 * whole fleet without a cursor. One shop at a time (Shopify: "refresh one store at a time"), and each shop is held
 * under a D1 lease so two overlapping ticks can never refresh the same shop concurrently. That lease does NOT stop
 * the Shopify library refreshing the same shop during a merchant request — see shopify-api-invariants.md.
 */
export async function probeInstalledShops(ports: ProbePorts, now: number): Promise<ProbeSummary> {
  const shops = await ports.probes.listDue(now, PROBE_COOLDOWN_MS, PROBE_BATCH_SIZE);
  // Counted before the batch runs: how many shops were overdue when this tick started.
  const overdue = await ports.probes.countDue(now, PROBE_COOLDOWN_MS);
  if (overdue > shops.length) console.log(JSON.stringify({ event: "uninstall_probe.backlog", overdue, batch: PROBE_BATCH_SIZE }));
  const counts: Record<Disposition | "leased", number> = { leased: 0, refreshed: 0, fresh: 0, noSession: 0, superseded: 0, uninstalled: 0, failed: 0, suppressed: 0 };
  const redacted = await ports.redaction.redactedAmong(shops);
  for (const shop of shops) {
    if (redacted.has(shop)) {
      counts.suppressed += 1;
      continue;
    }
    if (!(await ports.probes.acquireLease(shop, ports.clock.now(), PROBE_LEASE_MS))) {
      counts.leased += 1;
      continue;
    }
    counts[await probeOne(ports, shop)] += 1;
  }
  if (counts.suppressed > 0) console.log(JSON.stringify({ event: "uninstall_probe.suppressed", count: counts.suppressed }));
  return { examined: shops.length, overdue, ...counts };
}

async function probeOne(ports: ProbePorts, shop: string): Promise<Disposition> {
  // The uninstall, if any, is dated BEFORE the call: a reinstall that lands while we are on the wire is newer
  // than this observation and `decideUninstall` will refuse to undo it.
  const startedAt = ports.clock.now();
  const outcome = await refreshOrFail(ports.refresher, shop, startedAt);
  const settled = await settleOrFail(ports, shop, outcome, startedAt);
  await ports.probes.release(shop, settled.failure
    ? { succeeded: false, at: ports.clock.now(), code: settled.failure.code, detail: settled.failure.detail }
    : { succeeded: true, at: ports.clock.now() });
  return settled.disposition;
}

interface Settled {
  readonly disposition: Disposition;
  readonly failure?: { readonly code: string; readonly detail: string };
}

/** Whatever happens while acting on the outcome, the lease is released by the caller and the batch carries on. */
async function settleOrFail(ports: ProbePorts, shop: string, outcome: TokenRefreshOutcome, startedAt: number): Promise<Settled> {
  if (outcome.kind === "transient" || outcome.kind === "unexpected") {
    await shopLog("shopify.uninstall_probe.failed", shop, { kind: outcome.kind, detail: outcome.detail });
    return { disposition: "failed", failure: { code: outcome.kind, detail: outcome.detail } };
  }
  try {
    return { disposition: await settle(ports, shop, outcome, startedAt) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await shopLog("shopify.uninstall_probe.failed", shop, { kind: "settle_failed", detail });
    return { disposition: "failed", failure: { code: "settle_failed", detail } };
  }
}

async function refreshOrFail(refresher: ShopTokenRefresher, shop: string, now: number): Promise<TokenRefreshOutcome> {
  try {
    return await refresher.refresh(shop, now);
  } catch (error) {
    // A storage failure is not evidence about the installation.
    return { kind: "transient", detail: error instanceof Error ? error.message : String(error) };
  }
}

async function settle(ports: ProbePorts, shop: string, outcome: Exclude<TokenRefreshOutcome, { kind: "transient" | "unexpected" }>, startedAt: number): Promise<Disposition> {
  switch (outcome.kind) {
    case "refreshed": return "refreshed";
    case "fresh": return "fresh";
    case "superseded": return "superseded";
    case "no_session":
      await shopLog("shopify.uninstall_probe.no_session", shop);
      return "noSession";
    case "terminal": {
      const recorded = await ports.uninstall(shop, { occurredAt: startedAt, externalId: `token_refresh_rejected:${startedAt}` });
      await shopLog("shopify.uninstall_probe.token_rejected", shop, { recorded });
      // A reinstall newer than the probe wins: the pair that was rejected is not the shop's current one.
      return recorded === "ignored_stale" || recorded === "ignored_unknown_shop" ? "superseded" : "uninstalled";
    }
  }
}
