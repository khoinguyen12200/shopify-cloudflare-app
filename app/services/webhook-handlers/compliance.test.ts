import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsumerDelivery } from "~/services/webhook-consumer";
import { complianceHandler } from "./compliance";

const delivery = (topic: string): ConsumerDelivery => ({ id: "d1", shop: "fake.myshopify.com", topic, status: "processing", triggeredAt: 1 });

function fakeDependencies() {
  const calls: string[] = [];
  let tick = 0;
  return {
    calls,
    dependencies: {
      now: () => { tick += 40; return tick; },
      tenantPurge: {
        d1: { prepare: async () => { calls.push("prepare"); return { shop: "fake.myshopify.com", attachmentKeys: ["k1"] }; }, deleteRows: async () => { calls.push("rows"); return 3; } },
        r2: { delete: async () => { calls.push("r2"); } },
        kv: { deleteSessions: async () => { calls.push("kv"); return 1; } },
      },
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("complianceHandler", () => {
  it("purges the shop for shop/redact and logs the duration of the work, by shop hash", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { dependencies, calls } = fakeDependencies();
    await complianceHandler("SHOP_REDACT", dependencies)(delivery("shop/redact"));
    expect(calls).toEqual(["prepare", "r2", "kv", "rows"]);
    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain('"event":"compliance.handled"');
    expect(output).toContain('"durationMs":40');
    expect(output).not.toContain("fake.myshopify.com");
  });

  it.each([["CUSTOMERS_DATA_REQUEST", "customers/data_request"], ["CUSTOMERS_REDACT", "customers/redact"]] as const)(
    "answers %s without touching tenant data, because this app stores no customer data",
    async (topic, stored) => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const { dependencies, calls } = fakeDependencies();
      await complianceHandler(topic, dependencies)(delivery(stored));
      expect(calls).toEqual([]);
    },
  );

  it("lets a purge failure reach the queue so the delivery is retried", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { dependencies } = fakeDependencies();
    const failing = { ...dependencies, tenantPurge: { ...dependencies.tenantPurge, kv: { deleteSessions: async () => { throw new Error("kv down"); } } } };
    await expect(complianceHandler("SHOP_REDACT", failing)(delivery("shop/redact"))).rejects.toThrow("kv down");
  });
});
