import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { subscriptionsPort } from "~/wiring.server";

setupTestDatabase();

describe("entitlement installation eligibility", () => {
  it("does not manufacture a free subscription for an absent tenant", async () => {
    await runWithRequestContext(env, async () => {
      expect((await subscriptionsPort().current("absent")).status).toBe("UNKNOWN");
    });
  });

  it("does not manufacture free authorization before billing initialization", async () => {
    await runWithRequestContext(env, async () => {
      await env.DB.prepare("INSERT INTO shops (shop, installed_at, relationship_status) VALUES (?, ?, ?)")
        .bind("new-shop", 1, "INSTALLED").run();
      expect((await subscriptionsPort().current("new-shop")).status).toBe("UNKNOWN");
    });
  });

  it("denies a locally uninstalled shop despite an active subscription projection", async () => {
    await runWithRequestContext(env, async () => {
      await env.DB.prepare("INSERT INTO shops (shop, installed_at, uninstalled_at, relationship_status) VALUES (?, ?, ?, ?)")
        .bind("removed", 1, 2, "UNINSTALLED").run();
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id,revision) VALUES (?,?,?,?,?,?)")
        .bind("removed", "sub", "ACTIVE", 1, "event", 1).run();
      expect((await subscriptionsPort().current("removed")).status).toBe("UNKNOWN");
    });
  });
});
