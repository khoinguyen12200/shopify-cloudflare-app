import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { readAppHandle } from "./billing-app-handle.server";

const silence = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("readAppHandle", () => {
  it("asks Shopify once on a cold miss, then serves the cached handle", async () => {
    let calls = 0;
    const fetchHandle = async () => {
      calls += 1;
      return "my-app";
    };
    const dependencies = { kv: env.SESSION, shop: "cold-a.myshopify.com", fetchHandle };

    expect(await readAppHandle(dependencies)).toBe("my-app");
    expect(await readAppHandle(dependencies)).toBe("my-app");
    expect(calls).toBe(1);
  });

  it("caches per shop: another shop's cached handle is never served", async () => {
    await readAppHandle({ kv: env.SESSION, shop: "iso-a.myshopify.com", fetchHandle: async () => "handle-a" });
    const other = await readAppHandle({ kv: env.SESSION, shop: "iso-b.myshopify.com", fetchHandle: async () => "handle-b" });
    expect(other).toBe("handle-b");
  });

  it("degrades to null and logs when Shopify fails, caching nothing", async () => {
    const log = silence();
    const failing = { kv: env.SESSION, shop: "fail.myshopify.com", fetchHandle: async () => { throw new Error("boom"); } };
    expect(await readAppHandle(failing)).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("billing.app_handle.unavailable"));
    expect(await env.SESSION.get("billing:app-handle:fail.myshopify.com")).toBeNull();
    log.mockRestore();
  });

  it("ignores a corrupt cached value and refetches", async () => {
    await env.SESSION.put("billing:app-handle:corrupt.myshopify.com", JSON.stringify({ handle: 5 }));
    const handle = await readAppHandle({ kv: env.SESSION, shop: "corrupt.myshopify.com", fetchHandle: async () => "fresh" });
    expect(handle).toBe("fresh");
  });
});
