import { describe, expect, it, vi } from "vitest";
import { hashShop, shopLog } from "./shop-log";

describe("shop observability", () => {
  it("hashes the same shop to a stable non-reversible identifier", async () => {
    const first = await hashShop("secret.myshopify.com");
    const second = await hashShop("secret.myshopify.com");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("secret.myshopify.com");
  });

  it("logs the hash and preserves structured fields without the raw shop", async () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await shopLog("compliance.shop_redact", "secret.myshopify.com", {
      erased: 3,
      implemented: true,
      detail: null,
    });

    expect(write).toHaveBeenCalledTimes(1);
    const record = String(write.mock.calls[0]?.[0]);
    expect(record).toContain('"event":"compliance.shop_redact"');
    expect(record).toContain('"erased":3');
    expect(record).toContain('"implemented":true');
    expect(record).toContain('"detail":null');
    expect(record).toMatch(/"shopHash":"[a-f0-9]{64}"/);
    expect(record).not.toContain("secret.myshopify.com");
    write.mockRestore();
  });

  it("does not allow caller fields to replace tenant-safe log keys", async () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await shopLog("compliance.shop_redact", "secret.myshopify.com", {
      shopHash: "secret.myshopify.com",
      erased: 3,
    });

    expect(String(write.mock.calls[0]?.[0])).not.toContain("secret.myshopify.com");
    write.mockRestore();
  });
});
