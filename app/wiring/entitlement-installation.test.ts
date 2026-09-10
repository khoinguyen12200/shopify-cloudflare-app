import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
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
      await makeDb(env.DB).insert(schema.shops).values({ shop: "new-shop", installedAt: 1, relationshipStatus: "INSTALLED" }).run();
      expect((await subscriptionsPort().current("new-shop")).status).toBe("UNKNOWN");
    });
  });

  it("denies a locally uninstalled shop despite an active subscription projection", async () => {
    await runWithRequestContext(env, async () => {
      await makeDb(env.DB).insert(schema.shops).values({ shop: "removed", installedAt: 1, uninstalledAt: 2, relationshipStatus: "UNINSTALLED" }).run();
      await makeDb(env.DB).insert(schema.shopSubscriptions).values({ shop: "removed", subscriptionId: "sub", status: "ACTIVE", appliedOccurredAt: 1, appliedExternalId: "event", revision: 1 }).run();
      expect((await subscriptionsPort().current("removed")).status).toBe("UNKNOWN");
    });
  });
});
