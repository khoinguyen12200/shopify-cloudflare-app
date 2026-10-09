import { describe, expect, it } from "vitest";
import { fakeRedaction } from "~/test/redaction";

describe("redaction guard", () => {
  it("suppresses background observations for a tombstoned shop only", async () => {
    const { guard } = fakeRedaction(["gone.myshopify.com"]);
    expect(await guard.isSuppressed("gone.myshopify.com", "partner_event")).toBe(true);
    expect(await guard.isSuppressed("GONE.myshopify.com", "webhook_delivery")).toBe(true);
    expect(await guard.isSuppressed("other.myshopify.com", "partner_event")).toBe(false);
  });

  it("never suppresses the merchant's own install", async () => {
    const { guard } = fakeRedaction(["gone.myshopify.com"]);
    expect(await guard.isSuppressed("gone.myshopify.com", "merchant_install")).toBe(false);
  });

  it("finds the redacted subset in one lookup", async () => {
    const { guard } = fakeRedaction(["a.myshopify.com", "c.myshopify.com"]);
    const found = await guard.redactedAmong(["a.myshopify.com", "b.myshopify.com", "c.myshopify.com"]);
    expect([...found].sort()).toEqual(["a.myshopify.com", "c.myshopify.com"]);
    expect((await guard.redactedAmong([])).size).toBe(0);
  });

  it("clears on install exactly once", async () => {
    const { guard, hashes } = fakeRedaction(["gone.myshopify.com"]);
    expect(await guard.clearOnInstall("gone.myshopify.com")).toBe(true);
    expect(hashes.size).toBe(0);
    expect(await guard.clearOnInstall("gone.myshopify.com")).toBe(false);
    expect(await guard.clearOnInstall("never.myshopify.com")).toBe(false);
  });
});
