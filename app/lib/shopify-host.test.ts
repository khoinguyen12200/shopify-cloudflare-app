import { describe, expect, it } from "vitest";
import { isSafeHostParameter } from "./shopify-host";

const encode = (value: string) => btoa(value);

describe("isSafeHostParameter", () => {
  it("accepts a real admin host", () => {
    expect(isSafeHostParameter(encode("admin.shopify.com/store/firesio-trade-in"))).toBe(true);
  });

  it("rejects base64 that decodes to something that is not a URL host (the value that caused a production 500)", () => {
    expect(isSafeHostParameter("9998966025409999999")).toBe(false);
  });

  it("rejects base64 with an invalid length or padding", () => {
    expect(isSafeHostParameter("A")).toBe(false);
  });

  it("leaves a non-base64 value to the library, which rejects it cleanly", () => {
    expect(isSafeHostParameter("not base64!")).toBe(true);
    expect(isSafeHostParameter("")).toBe(true);
  });
});
