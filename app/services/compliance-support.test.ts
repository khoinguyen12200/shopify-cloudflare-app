import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { complianceHandlers } from "./compliance.server";
import { SupportRepo } from "~/models/support.server";

const SHOP = "alpha.myshopify.com";
const OTHER = "beta.myshopify.com";

setupTestDatabase();

const run = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

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
  it("deletes the shop's tickets AND their R2 objects", async () => {
    // The blobs are the part that is easy to forget: rows disappear, objects
    // keep being billed and stay readable by anyone holding a key.
    await run(async () => {
      const key = "support/alpha/keep-nothing";
      const created = await ticketWithFile(SHOP, key);
      expect(await env.UPLOADS.head(key)).not.toBeNull();

      await complianceHandlers.SHOP_REDACT({
        shop: SHOP,
        payload: { shop_domain: SHOP },
      });

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

      await complianceHandlers.SHOP_REDACT({
        shop: SHOP,
        payload: { shop_domain: SHOP },
      });

      expect(await new SupportRepo().find(OTHER, theirs.id)).toBeDefined();
      expect(await env.UPLOADS.head(theirsKey)).not.toBeNull();
    });
  });

  it("reports the support rows it erased, so the count is not silently short", async () => {
    await run(async () => {
      await ticketWithFile(SHOP, "support/alpha/counted");

      const outcome = await complianceHandlers.SHOP_REDACT({
        shop: SHOP,
        payload: { shop_domain: SHOP },
      });

      expect(outcome.implemented).toBe(true);
      // 1 ticket + 1 message + 1 attachment on top of the shop row.
      expect(outcome.affected).toBeGreaterThanOrEqual(3);
    });
  });
});
