import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "~/models/shops.server";
import {
  handleCompliance,
  isComplianceTopic,
  complianceHandlers,
} from "./compliance.server";

setupTestDatabase();

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

describe("compliance topic registry", () => {
  it("covers all three mandatory topics", () => {
    // If Shopify's mandatory set ever changes, this is what notices.
    expect(Object.keys(complianceHandlers).sort()).toEqual([
      "CUSTOMERS_DATA_REQUEST",
      "CUSTOMERS_REDACT",
      "SHOP_REDACT",
    ]);
  });

  it("rejects a topic it does not handle", () => {
    expect(isComplianceTopic("ORDERS_CREATE")).toBe(false);
  });

  it("degrades predictably on an unknown topic instead of throwing", async () => {
    const outcome = await inRequest(() =>
      handleCompliance("SOMETHING_NEW", { shop: "s.myshopify.com", payload: {} }),
    );
    expect(outcome).toBeNull();
  });
});

describe("shop/redact", () => {
  it("erases the shop's row", async () => {
    const shop = "redact-me.myshopify.com";

    const after = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await handleCompliance("SHOP_REDACT", {
        shop,
        payload: { shop_domain: shop, shop_id: 1 },
      });
      return repo.get(shop);
    });

    expect(after).toBeUndefined();
  });

  it("reports how many rows it actually erased", async () => {
    const shop = "counted.myshopify.com";

    const outcome = await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1);
      return handleCompliance("SHOP_REDACT", {
        shop,
        payload: { shop_domain: shop },
      });
    });

    expect(outcome).toMatchObject({ topic: "SHOP_REDACT", affected: 1 });
  });

  it("is idempotent — a replayed delivery erases nothing more", async () => {
    const shop = "twice.myshopify.com";

    const second = await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1);
      await handleCompliance("SHOP_REDACT", { shop, payload: { shop_domain: shop } });
      // Deliveries are at-least-once; the replay must not throw.
      return handleCompliance("SHOP_REDACT", { shop, payload: { shop_domain: shop } });
    });

    expect(second).toMatchObject({ affected: 0 });
  });

  it("falls back to the authenticated shop when the payload omits the domain", async () => {
    const shop = "fallback.myshopify.com";

    const outcome = await inRequest(async () => {
      await new ShopRepo().recordInstall(shop, 1);
      return handleCompliance("SHOP_REDACT", { shop, payload: {} });
    });

    expect(outcome).toMatchObject({ affected: 1 });
  });

  it("leaves other shops untouched", async () => {
    const other = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall("victim.myshopify.com", 1);
      await repo.recordInstall("bystander.myshopify.com", 1);
      await handleCompliance("SHOP_REDACT", {
        shop: "victim.myshopify.com",
        payload: { shop_domain: "victim.myshopify.com" },
      });
      return repo.get("bystander.myshopify.com");
    });

    expect(other).toBeDefined();
  });
});

describe("customers/* — honest about storing no customer data", () => {
  it("data_request reports nothing collected", async () => {
    const outcome = await inRequest(() =>
      handleCompliance("CUSTOMERS_DATA_REQUEST", {
        shop: "s.myshopify.com",
        payload: { customer: { id: 1 }, orders_requested: [1, 2] },
      }),
    );
    expect(outcome).toMatchObject({ affected: 0 });
  });

  it("redact reports nothing erased", async () => {
    const outcome = await inRequest(() =>
      handleCompliance("CUSTOMERS_REDACT", {
        shop: "s.myshopify.com",
        payload: { customer: { id: 1 }, orders_to_redact: [1] },
      }),
    );
    expect(outcome).toMatchObject({ affected: 0 });
  });
});
