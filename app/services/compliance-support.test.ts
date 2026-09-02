import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { SupportRepo } from "~/models/support.server";
import { TenantPurgeRepo } from "~/models/tenant-purge.server";
import { KVSessionStorage } from "~/session-storage.server";
import { handleCompliance } from "./compliance.server";
import { Session } from "@shopify/shopify-api";

const SHOP = "alpha.myshopify.com";
const OTHER = "beta.myshopify.com";

setupTestDatabase();

const run = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const dispatch = (shop: string) => handleCompliance("SHOP_REDACT", { shop, payload: { shop_domain: shop } }, { tenantPurge: { d1: { prepare: (tenant) => new TenantPurgeRepo().prepareTenantPurge(tenant), deleteRows: (tenant) => new TenantPurgeRepo().deleteTenantRows(tenant) }, r2: { delete: (keys) => env.UPLOADS.delete([...keys]) }, kv: { deleteSessions: async (tenant) => { const storage = new KVSessionStorage(env.SESSION); const sessions = await storage.findSessionsByShop(tenant); await storage.deleteSessions(sessions.map(({ id }) => id)); return sessions.length; } } } });
const offlineSession = (shop: string) => new Session({ id: `offline_${shop}`, shop, state: "state", isOnline: false, accessToken: "token", scope: "write_products" });

/** A ticket with one attachment whose blob really exists in the test bucket. */
async function ticketWithFile(shop: string, key: string) {
  const repo = new SupportRepo();
  const created = await repo.open({
    shop,
    shopName: "Store",
    merchantEmail: "owner@store.test",
    ccEmails: [],
    category: "bug",
    subject: "Broken",
    body: "Look at this",
    authorName: "Store",
    locale: null,
    at: 1_000,
  });

  await env.UPLOADS.put(key, "pretend-bytes");
  await repo.attach({
    shop,
    messageId: created.messageId,
    id: crypto.randomUUID(),
    r2Key: key,
    filename: "shot.png",
    contentType: "image/png",
    sizeBytes: 13,
    at: 1_000,
  });

  return created;
}

describe("shop/redact and support data", () => {
  it("erases target D1, R2, and KV resources while preserving other tenant and global checkpoint", async () => {
    await run(async () => {
      const targetKey = "support/alpha/full-purge";
      const otherKey = "support/beta/full-purge";
      const targetTicket = await ticketWithFile(SHOP, targetKey);
      const otherTicket = await ticketWithFile(OTHER, otherKey);

      const storage = new KVSessionStorage(env.SESSION);
      const targetSession = offlineSession(SHOP);
      const otherSession = offlineSession(OTHER);
      await storage.storeSession(targetSession);
      await storage.storeSession(otherSession);
      await env.DB.prepare("INSERT INTO shopify_sync_checkpoints (name, last_succeeded_at) VALUES (?, ?)").bind("global", 1).run();

      await dispatch(SHOP);

      expect(await new SupportRepo().find(SHOP, targetTicket.id)).toBeUndefined();
      expect(await env.UPLOADS.head(targetKey)).toBeNull();
      expect(await storage.loadSession(targetSession.id)).toBeUndefined();
      expect(await new SupportRepo().find(OTHER, otherTicket.id)).toBeDefined();
      expect(await env.UPLOADS.head(otherKey)).not.toBeNull();
      expect(await storage.loadSession(otherSession.id)).toBeDefined();
      expect(await env.DB.prepare("SELECT count(*) AS count FROM shopify_sync_checkpoints WHERE name = ?").bind("global").first<{ count: number }>()).toMatchObject({ count: 1 });
    });
  });

  it("deletes the shop's tickets AND their R2 objects", async () => {
    // The blobs are the part that is easy to forget: rows disappear, objects
    // keep being billed and stay readable by anyone holding a key.
    await run(async () => {
      const key = "support/alpha/keep-nothing";
      const created = await ticketWithFile(SHOP, key);
      expect(await env.UPLOADS.head(key)).not.toBeNull();

      await dispatch(SHOP);

      expect(await new SupportRepo().find(SHOP, created.id)).toBeUndefined();
      expect(await env.UPLOADS.head(key)).toBeNull();
    });
  });

  it("leaves another shop's tickets and objects alone", async () => {
    await run(async () => {
      const mineKey = "support/alpha/mine";
      const theirsKey = "support/beta/theirs";
      await ticketWithFile(SHOP, mineKey);
      const theirs = await ticketWithFile(OTHER, theirsKey);

      await dispatch(SHOP);

      expect(await new SupportRepo().find(OTHER, theirs.id)).toBeDefined();
      expect(await env.UPLOADS.head(theirsKey)).not.toBeNull();
    });
  });

  it("reports the support rows it erased, so the count is not silently short", async () => {
    await run(async () => {
      await ticketWithFile(SHOP, "support/alpha/counted");

      const outcome = await dispatch(SHOP);
      if (!outcome) throw new Error("expected shop redact outcome");

      expect(outcome.implemented).toBe(true);
      // 1 ticket + 1 message + 1 attachment on top of the shop row.
      expect(outcome.affected).toBeGreaterThanOrEqual(3);
    });
  });
});
