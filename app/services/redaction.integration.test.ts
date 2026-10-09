import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "~/db/client";
import { shopifyEvents, shopifySyncCheckpoints, shops } from "~/db/schema";
import { RedactedShopRepo } from "~/models/redacted-shops.server";
import { shopHasher } from "~/adapters/shop-hasher";
import type { PartnerHistoryEvent, ShopifyPartnerPort } from "~/ports/shopify-partner";
import { runWithRequestContext } from "~/request-context.server";
import { afterAuth } from "~/shopify.server";
import { setupTestDatabase } from "~/test/db";
import { historyLedger, refreshShopHistory } from "~/wiring/billing.server";
import { shopSyncCheckpoints } from "~/wiring/repositories.server";
import { redactionGuard } from "~/wiring/redaction.server";
import { reconcileHistory } from "./reconcile-shopify-history";

setupTestDatabase();
afterEach(() => vi.restoreAllMocks());

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const db = () => makeDb(env.DB);

const relationship = (id: string, shop: string): PartnerHistoryEvent => ({
  kind: "relationship", id, occurredAt: "2026-01-01T00:00:00.000Z", shop, shopId: `gid://shopify/Shop/${id}`, type: "INSTALLED", reason: null, reasonDescription: null,
});
const partnerOf = (events: PartnerHistoryEvent[]): ShopifyPartnerPort => ({
  listHistoricalEvents: async () => ({ events, hasNextPage: false, endCursor: null }),
  activeSubscription: async () => null,
});
const tombstone = (shop: string) => inRequest(async () => new RedactedShopRepo().mark(await shopHasher.hash(shop), 1));
const sweep = (events: PartnerHistoryEvent[]) => inRequest(() => reconcileHistory({
  partner: partnerOf(events), checkpoint: shopSyncCheckpoints(), ledger: historyLedger(), clock: { now: () => 5_000 }, appId: "app", redaction: redactionGuard(),
}, 5_000));
const shopRows = (shop: string) => db().select().from(shops).where(eq(shops.shop, shop));
const eventRows = (shop: string) => db().select().from(shopifyEvents).where(eq(shopifyEvents.shop, shop));

describe("Partner history honours the redaction tombstone (real D1)", () => {
  it("creates no shop row and no event row for a tombstoned shop, but still applies a live shop", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const gone = "tomb-partner-gone.myshopify.com";
    const live = "tomb-partner-live.myshopify.com";
    await tombstone(gone);

    const result = await sweep([relationship("ev-gone", gone), relationship("ev-live", live)]);

    expect(result).toEqual({ status: "succeeded", pages: 1, events: 1, suppressed: 1 });
    expect(await shopRows(gone)).toEqual([]);
    expect(await eventRows(gone)).toEqual([]);
    expect(await shopRows(live)).toHaveLength(1);
    expect(await eventRows(live)).toHaveLength(1);
    const lines = log.mock.calls.map(String);
    expect(lines.some((line) => line.includes('"event":"partner_history.suppressed"') && line.includes('"count":1'))).toBe(true);
    expect(lines.join("\n")).not.toContain(gone);
  });

  it("applies the same event again once the merchant has reinstalled", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const shop = "tomb-partner-back.myshopify.com";
    await tombstone(shop);
    await sweep([relationship("ev-back", shop)]);
    expect(await shopRows(shop)).toEqual([]);

    await inRequest(() => afterAuth({ session: { shop } }, async () => undefined));
    await sweep([relationship("ev-back", shop)]);

    expect(await shopRows(shop)).toHaveLength(1);
    expect(await eventRows(shop)).toHaveLength(1);
  });

  it("a per-shop refresh for a tombstoned shop writes nothing, not even the checkpoint that is named after the shop", async () => {
    const shop = "tomb-refresh.myshopify.com";
    await tombstone(shop);

    const result = await inRequest(() => refreshShopHistory(env, shop, 9_000));

    expect(result).toMatchObject({ status: "failed", code: "SHOP_REDACTED" });
    expect(await shopRows(shop)).toEqual([]);
    expect(await db().select().from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, `partner_history:${shop}`))).toEqual([]);
  });
});
