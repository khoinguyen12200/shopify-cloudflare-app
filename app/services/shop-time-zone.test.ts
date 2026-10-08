import { describe, expect, it } from "vitest";
import { resolveShopTimeZone, type ShopTimeZonePorts } from "./shop-time-zone";

function fakes(options: { stored?: string | null; fetched?: string | null }) {
  const calls: string[] = [];
  const ports: ShopTimeZonePorts = {
    stored: async () => options.stored ?? null,
    fetch: async () => { calls.push("fetch"); return options.fetched ?? null; },
    record: async (_shop, zone) => { calls.push(`record:${zone}`); },
    unavailable: async () => { calls.push("unavailable"); },
  };
  return { calls, ports };
}

describe("resolveShopTimeZone", () => {
  it("uses the stored zone without asking Shopify", async () => {
    const { calls, ports } = fakes({ stored: "Asia/Ho_Chi_Minh", fetched: "America/Chicago" });
    expect(await resolveShopTimeZone("a.myshopify.com", ports)).toBe("Asia/Ho_Chi_Minh");
    expect(calls).toEqual([]);
  });

  it("asks Shopify once when nothing is stored, and records the answer", async () => {
    const { calls, ports } = fakes({ fetched: "America/Toronto" });
    expect(await resolveShopTimeZone("a.myshopify.com", ports)).toBe("America/Toronto");
    expect(calls).toEqual(["fetch", "record:America/Toronto"]);
  });

  it("treats an unusable stored value as missing and repairs it", async () => {
    const { calls, ports } = fakes({ stored: "Mars/Olympus_Mons", fetched: "Europe/Paris" });
    expect(await resolveShopTimeZone("a.myshopify.com", ports)).toBe("Europe/Paris");
    expect(calls).toEqual(["fetch", "record:Europe/Paris"]);
  });

  it("falls back to UTC, records nothing and reports it when Shopify cannot say", async () => {
    const { calls, ports } = fakes({ fetched: null });
    expect(await resolveShopTimeZone("a.myshopify.com", ports)).toBe("UTC");
    expect(calls).toEqual(["fetch", "unavailable"]);
  });

  it("never records a zone Shopify sent that the platform does not know", async () => {
    const { calls, ports } = fakes({ fetched: "Not/AZone" });
    expect(await resolveShopTimeZone("a.myshopify.com", ports)).toBe("UTC");
    expect(calls).toEqual(["fetch", "unavailable"]);
  });
});
