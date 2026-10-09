import { describe, expect, it } from "vitest";
import { decideTombstone, normalizeShopDomain, type ObservationSource } from "./redaction-tombstone";

const BACKGROUND: readonly ObservationSource[] = ["partner_event", "webhook_delivery", "scheduled_sweep"];

describe("decideTombstone", () => {
  it.each(BACKGROUND)("suppresses a %s observation about a tombstoned shop", (source) => {
    expect(decideTombstone(true, source)).toBe("suppress");
  });

  it.each(BACKGROUND)("lets a %s observation about an unknown shop proceed", (source) => {
    expect(decideTombstone(false, source)).toBe("proceed");
  });

  it("clears the tombstone only when the merchant installs again", () => {
    expect(decideTombstone(true, "merchant_install")).toBe("clear");
  });

  it("an install with no tombstone just proceeds", () => {
    expect(decideTombstone(false, "merchant_install")).toBe("proceed");
  });

  it("covers every source in both states", () => {
    const sources: readonly ObservationSource[] = [...BACKGROUND, "merchant_install"];
    for (const source of sources) for (const state of [true, false]) {
      expect(["proceed", "suppress", "clear"]).toContain(decideTombstone(state, source));
    }
  });
});

describe("normalizeShopDomain", () => {
  it("lower-cases and trims so spelling never changes the key", () => {
    expect(normalizeShopDomain("  Foo.MyShopify.com ")).toBe("foo.myshopify.com");
  });
});
